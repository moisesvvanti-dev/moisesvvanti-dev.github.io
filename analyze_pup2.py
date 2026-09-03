import struct
from collections import Counter

with open('pup_extracted/PS4UPDATE1.PUP', 'rb') as f:
    d = f.read(0x100)

print('PUP Header analysis:')
print('  Magic: ' + d[0:4].hex())
print('  Bytes 4-15: ' + d[4:16].hex())
print('  Word at 0x10: ' + hex(struct.unpack('<I', d[16:20])[0]))
print('  Word at 0x14: ' + hex(struct.unpack('<I', d[20:24])[0]))
print('  Word at 0x18: ' + hex(struct.unpack('<I', d[24:28])[0]))
print('  Word at 0x1C: ' + hex(struct.unpack('<I', d[28:32])[0]))

with open('pup_extracted/PS4UPDATE1.PUP', 'rb') as f:
    data = f.read(0x4000)

elf_count = 0
idx = 0
while idx < len(data) - 4:
    if data[idx:idx+4] == b'\x7fELF':
        elf_count += 1
        print()
        print('ELF found at offset ' + hex(idx))
        print('  Class: ' + ('32-bit' if data[idx+4] == 1 else '64-bit'))
        print('  Endian: ' + ('LE' if data[idx+5] == 1 else 'BE'))
        idx += 1
    else:
        idx += 1

if elf_count == 0:
    print()
    print('No ELF headers found in first 16KB')

entropy_data = data[64:320]
counts = Counter(entropy_data)
entropy = -sum((c/len(entropy_data)) * ((c/len(entropy_data)).bit_length() - 1) for c in counts.values())
print()
print('Entropy of data[64:320]: ' + format(entropy, '.2f'))
print('  Unique bytes: ' + str(len(counts)) + '/256')
if entropy > 7.5:
    print('  HIGH ENTROPY - suggests encryption')
else:
    print('  Normal entropy - may be plaintext')

with open('pup_extracted/PS4UPDATE2.PUP', 'rb') as f:
    d2 = f.read(64)
print()
print('PS4UPDATE2.PUP header: ' + d2[:32].hex())
print('  Magic: ' + d2[:4].hex())
