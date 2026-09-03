import struct

with open("pup_extracted/PS4UPDATE1.PUP", "rb") as f:
    data = f.read()

known_files = [
    b"SceShellCore", b"SceKernel", b"libSceLibcInternal",
    b"SceBsd", b"SceSysCore", b"SceLibkernel",
    b"webcore", b"webkit", b"javascriptcore", b"WTF",
    b"libc", b"libkernel", b"libSce",
]

print("Searching for firmware files in PS4UPDATE1.PUP...")
for name in known_files:
    idx = data.find(name)
    if idx >= 0:
        end = data.find(b"\x00", idx)
        if end > idx:
            filename = data[idx:end].decode("ascii", errors="replace")
        else:
            filename = data[idx:idx+32].decode("ascii", errors="replace")
        # Clean non-ASCII chars
        clean = "".join(c if ord(c) < 128 else "?" for c in filename)
        print(f"  Found '{clean}' at offset {idx:#x}")

# Also search for ".elf" strings
print("\nSearching for .elf files...")
idx = 0
count = 0
while count < 20:
    idx = data.find(b".elf", idx)
    if idx < 0:
        break
    # Get the filename before .elf
    start = max(0, idx - 40)
    end = idx + 4
    name_bytes = data[start:end]
    # Try to find the start of the name
    name_start = 0
    for i in range(len(name_bytes) - 1, -1, -1):
        if name_bytes[i] == 0 or name_bytes[i] < 32:
            name_start = i + 1
            break
    if name_start < len(name_bytes):
        name = name_bytes[name_start:].decode("ascii", errors="replace")
        clean = "".join(c if ord(c) < 128 else "?" for c in name)
        if clean and "elf" in clean.lower():
            print(f"  {clean} at offset {idx:#x}")
            count += 1
    idx += 1

