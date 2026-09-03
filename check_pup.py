import sys
sys.path.insert(0, "PFU-PupFileUnpacker/src")
from core.slb2_file import SLB2File

# Check PS4UPDATE1.PUP - this is the main firmware update
file1 = "pup_extracted/PS4UPDATE1.PUP"
with open(file1, "rb") as f:
    data1 = f.read()

print(f"PS4UPDATE1.PUP: {len(data1)} bytes")
print(f"First 64 bytes: {data1[:64].hex()}")
print(f"Magic: {data1[:4]}")

# Check if it's an SLB2
if data1[:4] == b"SLB2":
    print("\nPS4UPDATE1.PUP is an SLB2 container!")
    slb2 = SLB2File(file1)
    if slb2.load():
        print(f"  Version: {slb2.version}")
        print(f"  Entries: {len(slb2.entries)}")
        for i, entry in enumerate(slb2.entries):
            print(f"  Entry {i}: {entry['name']} at {entry['offset']:#x} size={entry['size']}")
else:
    print("PS4UPDATE1.PUP is NOT an SLB2 container")
    # Check for other known magic numbers
    magics = {
        b"\x7fELF": "ELF",
        b"\x1f\x8b": "GZIP",
        b"PK\x03\x04": "ZIP",
        b"\x89PNG": "PNG",
        b"\xff\xd8\xff": "JPEG",
        b"\x00\x00\x00\x00": "NULL",
    }
    for magic, name in magics.items():
        if data1[:len(magic)] == magic:
            print(f"  Magic: {name}")

# Check PS4UPDATE2.PUP
file2 = "pup_extracted/PS4UPDATE2.PUP"
with open(file2, "rb") as f:
    data2 = f.read()

print(f"\nPS4UPDATE2.PUP: {len(data2)} bytes")
print(f"First 64 bytes: {data2[:64].hex()}")
print(f"Magic: {data2[:4]}")

if data2[:4] == b"SLB2":
    print("\nPS4UPDATE2.PUP is an SLB2 container!")
    slb2 = SLB2File(file2)
    if slb2.load():
        print(f"  Version: {slb2.version}")
        print(f"  Entries: {len(slb2.entries)}")
        for i, entry in enumerate(slb2.entries):
            print(f"  Entry {i}: {entry['name']} at {entry['offset']:#x} size={entry['size']}")

