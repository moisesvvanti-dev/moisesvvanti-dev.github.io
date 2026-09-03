import struct

with open("bin/ps4-pup_decrypt.bin", "rb") as f:
    data = f.read()

print(f"File size: {len(data)} bytes")
print(f"First 16 bytes: {data[:16].hex()}")

# Check if it's an ELF file
if data[:4] == b"\x7fELF":
    print("This is an ELF file!")
    print(f"  Class: {'32-bit' if data[4] == 1 else '64-bit' if data[4] == 2 else 'Unknown'}")
    print(f"  Endian: {'LE' if data[5] == 1 else 'BE'}")
    print(f"  Type: {struct.unpack('<H', data[16:18])[0]}")
    print(f"  Machine: {struct.unpack('<H', data[18:20])[0]}")
else:
    print("This is NOT an ELF file - it's a raw binary")
    print(f"  First byte: {data[0]:#x} (JMP instruction)")

# Search for potential AES keys (16-byte sequences with high entropy)
print("\nSearching for potential AES keys...")
potential_keys = []
for i in range(0, len(data) - 32, 16):
    chunk = data[i:i+16]
    # Skip if contains null bytes or is all printable ASCII
    if any(b == 0 for b in chunk):
        continue
    if all(32 <= b <= 126 for b in chunk):
        continue
    
    # Check entropy
    from collections import Counter
    counts = Counter(chunk)
    unique = len(counts)
    if unique >= 12:  # High entropy means likely key material
        potential_keys.append((i, chunk.hex()))

print(f"Found {len(potential_keys)} potential AES keys")
for offset, key in potential_keys[:50]:
    print(f"  Offset {offset:#x}: {key}")

# Also search for the specific PS4 master key
master_key = bytes([0x2C, 0xFE, 0x94, 0xE1, 0xD0, 0xFA, 0x4E, 0xF5, 0x9C, 0xDF, 0x0B, 0x6E, 0x13, 0xA7, 0x98, 0x2C])
idx = data.find(master_key)
if idx >= 0:
    print(f"\nFound PS4 master key at offset {idx:#x}")
else:
    print("\nPS4 master key not found in binary")

# Search for the PUP encryption key
# Look for 16-byte chunks that appear in the data section
# The binary might have the key embedded as a constant
# Let's look for the string "Decrypting" and check nearby constants
decrypt_idx = data.find(b"Decrypting")
if decrypt_idx >= 0:
    print(f"\nFound 'Decrypting' at offset {decrypt_idx:#x}")
    # Look for potential keys near this string
    search_start = max(0, decrypt_idx - 0x1000)
    search_end = min(len(data), decrypt_idx + 0x1000)
    nearby = data[search_start:search_end]
    print(f"  Searching in range {search_start:#x} - {search_end:#x}")

# Save the extracted strings for analysis
strings = []
current = b""
for b in data:
    if 32 <= b <= 126:
        current += bytes([b])
    else:
        if len(current) >= 4:
            strings.append(current.decode("ascii"))
        current = b""
if len(current) >= 4:
    strings.append(current.decode("ascii"))

# Filter for interesting strings
interesting = [s for s in strings if any(k in s.lower() for k in ["key", "aes", "decrypt", "pup", "ps4", "slb", "update", "header", "segment", "block", "table", "failed", "open", "read", "write", "create", "mkdir", "strange", "verif", "type", "network", "usb"]]
print(f"\nInteresting strings found:")
for s in interesting[:50]:
    print(f"  {s}")

