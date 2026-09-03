import struct

# Search for known firmware file names in PS4UPDATE1.PUP
with open("pup_extracted/PS4UPDATE1.PUP", "rb") as f:
    data = f.read()

# Known PS4 firmware file names
known_files = [
    b"SceShellCore",
    b"SceKernel",
    b"libSceLibcInternal",
    b"SceBsd",
    b"SceSysCore",
    b"SceLibkernel",
    b"ScePiglet",
    b"SceGnmDriver",
    b"SceVideoCore",
    b"SceAudioCore",
    b"SceNet",
    b"SceNp",
    b"SceSaveData",
    b"SceSystemService",
    b"SceUserService",
    b"SceContentDelete",
    b"webcore",
    b"webkit",
    b"javascriptcore",
    b"WTF",
    b"libc",
    b"libkernel",
    b"libSce",
]

print("Searching for known firmware files in PS4UPDATE1.PUP...")
for name in known_files:
    idx = data.find(name)
    if idx >= 0:
        # Try to get more context around the match
        context = data[idx:idx+64]
        # Try to extract the filename (null-terminated string)
        end = data.find(b"\x00", idx)
        if end > idx:
            filename = data[idx:end].decode("utf-8", errors="replace")
        else:
            filename = data[idx:idx+32].decode("utf-8", errors="replace")
        print(f"  Found '{filename}' at offset {idx:#x}")

# Also search in PS4UPDATE2.PUP
print("\nSearching in PS4UPDATE2.PUP...")
with open("pup_extracted/PS4UPDATE2.PUP", "rb") as f:
    data2 = f.read()

for name in known_files:
    idx = data2.find(name)
    if idx >= 0:
        end = data2.find(b"\x00", idx)
        if end > idx:
            filename = data2[idx:end].decode("utf-8", errors="replace")
        else:
            filename = data2[idx:idx+32].decode("utf-8", errors="replace")
        print(f"  Found '{filename}' at offset {idx:#x}")

# Also look for the PUP magic in the sub-files (might indicate inner PUP structure)
for name, file_data in [("PS4UPDATE1.PUP", data), ("PS4UPDATE2.PUP", data2)]:
    # Search for PS4 magic
    magic = b"\x4f\x15\x3d\x1d"
    idx = 0
    count = 0
    while True:
        idx = file_data.find(magic, idx)
        if idx < 0 or count > 20:
            break
        if idx > 0:
            print(f"  Found PS4 magic at {name} offset {idx:#x}")
        count += 1
        idx += 1

