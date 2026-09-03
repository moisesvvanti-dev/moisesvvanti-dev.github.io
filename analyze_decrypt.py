from collections import Counter
with open("bin/ps4-pup_decrypt.bin", "rb") as f:
    data = f.read()
print("File size: " + str(len(data)) + " bytes")
print("First 16: " + data[:16].hex())
if data[:4] == b"\x7fELF":
    print("This is an ELF file!")
else:
    print("Not an ELF - raw binary")
print("\nSearching for AES keys...")
keys = []
for i in range(0, len(data) - 32, 16):
    chunk = data[i:i+16]
    if any(b == 0 for b in chunk): continue
    if all(32 <= b <= 126 for b in chunk): continue
    if len(set(chunk)) >= 12:
        keys.append((i, chunk.hex()))
print("Found " + str(len(keys)) + " potential keys")
for offset, key in keys[:25]:
    print("  " + hex(offset) + ": " + key)
