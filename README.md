# WebKit CSSFontFace Exploit for PS4/PS5

### Vulnerability Scope

|               | CSSFontFace |
| :------------ | :---------- |
| PlayStation 4 | 6.00-13.52  |
| PlayStation 5 | 1.00-13.40  |

### Exploitable In

|               | CSSFontFace |
| :------------ | :---------- |
| PlayStation 4 | 6.00-11.02  |
| PlayStation 5 | 1.00-8.60   |

* PS5 is also exploitable if ASLR can be defeated, either through a heap-shaping trick or a separate leak bug, and the expected vtable pointer can be recovered before the native crash path.

## Supported by This Repository

|               | CSSFontFace | Kernel Exploit |
| :------------ | :---------- |:-------------- |
| PlayStation 4 | 6.00-11.02  | 7.00-11.02     |
| PlayStation 4 | 13.52       | (Framework)    |
| PlayStation 5 | N/A         | N/A            |

* add your payload/hen of choice in public/src named as `payload.bin`
  
## Limitations

* Newer WebKit versions on PlayStation 4 [11.5x-latest] and PlayStation 5 [9.00-latest] redesigned CSSFontFace get/set property handling and introduced `m_propertiesOrCSSConnection`. Because of this and other layout changes, the `m_featureSettings` read/write primitive used by this repository is no longer usable on firmware versions above the ranges listed here.
* On PlayStation 5, vtable checks and WebKit ASLR prevent this repository's chain from working unless a separate ASLR defeat and vtable recovery workaround is found.

## Firmware 13.52 Support Status

**Framework infrastructure has been added for firmware 13.52, but the exploit is NOT yet functional.**

### What has been implemented:
- ✅ Version detection for 13.52 (already handled by regex)
- ✅ Constants structure placeholder in `ps4/constants.js`
- ✅ Placeholder kernel patch file `ps4/patches/1352.bin`
- ✅ Cache manifest entry for 1352.bin

### What is still needed (requires reverse engineering of the firmware binary):

1. **CSSFontFace struct offsets**: The `m_featureSettings` read primitive used on firmware 6.00-11.02 does NOT work on 13.52 because the struct layout was redesigned with `m_propertiesOrCSSConnection`.
   - All CSSFontFace field offsets need to be reverse engineered
   - A new exploitation primitive may be needed

2. **WebKit ROP gadgets**: Every ROP gadget offset must be found in the 13.52 WebKit binary
   - Use `ropper` or `ROPgadget` on the WebKit ELF binary
   - Search for: POP_RDI_RET, POP_RAX_RET, MOV_RAX_QWORD_PTR_RDI_RET, etc.

3. **Kernel offsets**: The kernel binary for 13.52 has different offsets for:
   - `SYSENT_661` (sysent table entry for syscall 661)
   - `JMP_RSI_GADGET` (kernel ROP gadget)
   - `KL_LOCK` (kqueue lock offset)
   - `EVF_OFFSET` (event flag offset)

4. **Kernel patch shellcode**: A custom shellcode payload must be created for the 13.52 kernel

5. **Library offsets**: libkernel and libc offsets for `__error`, `strerror`, `pthread_create`

### How to obtain the offsets:
1. Dump the WebKit and kernel binaries from a PS4 on firmware 13.52
2. Load them in Ghidra or IDA Pro
3. Search for the required gadget patterns
4. Update the constants in `ps4/constants.js` under the `13.52` section
5. Create the proper kernel patch binary and replace `ps4/patches/1352.bin`

Technical writeup: https://linearfox.com/blog/cssfontface-uaf-playstation

# Collaborators / Research References

[ufm42](https://github.com/ufm42): Bug Research, Full Chain Exploit Development.  
[Nathan Fargo](https://github.com/ntfargo) aka @ntfargo: Bug Research, Writeup, Exploit Development.   
[Dr.Yenyen](https://github.com/DrYenyen): Testing.  
Hacking the PS4 by CTurt (2015) https://cturt.github.io/ps4.html    
Old PS5 Webkit contributors. (2022) https://github.com/ChendoChap/PS5-Webkit-Execution
