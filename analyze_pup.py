import sys
sys.path.insert(0, "PFU-PupFileUnpacker/src")

from core.pup_file import Pup
from crypto.pup_analyzer import PupAnalyzer
from crypto.decryption import PupDecryption

# Try to analyze PS4UPDATE1.PUP
print("=== Analyzing PS4UPDATE1.PUP ===")
pup = Pup("pup_extracted/PS4UPDATE1.PUP")
if pup.load():
    print(f"Magic: {pup.magic.hex()}")
    print(f"Version: {pup.version}")
    print(f"Segments: {len(pup.segment_table)}")
    
    # Try to extract segments
    for i, seg in enumerate(pup.segment_table[:5]):
        print(f"\nSegment {i}:")
        print(f"  Offset: {seg['offset']:#x}")
        print(f"  Size: {seg['compressed_size']}")
        if seg.get("is_synthetic"):
            print(f"  Synthetic: True")
    
    # Try to extract the first segment
    if len(pup.segment_table) > 0:
        pup.extract_segment(0, "pup_extracted/segment_0.bin")
        with open("pup_extracted/segment_0.bin", "rb") as f:
            seg_data = f.read()
        print(f"\nSegment 0 first 32 bytes: {seg_data[:32].hex()}")

# Also try PupAnalyzer
print("\n=== Analyzer ===")
analyzer = PupAnalyzer()
with open("pup_extracted/PS4UPDATE1.PUP", "rb") as f:
    data = f.read()

analysis = analyzer.analyze_file(data)
print(f"Header: {analysis['header']}")
print(f"Encryption: {analysis['encryption']}")
print(f"Patterns: {len(analysis['patterns'])}")
print(f"Suspected keys: {len(analysis['suspected_keys'])}")

# Try decryption
print("\n=== Decryption attempts ===")
dec = PupDecryption()
result = dec.analyze_encryption(data)
print(f"Result: {result}")

# Try to find the key by looking at the first 16 bytes of the data
# The PS4 PUP might use the first 16 bytes as the encrypted key
print(f"\nFirst 16 bytes of data: {data[:16].hex()}")
print(f"Bytes 16-32: {data[16:32].hex()}")

# Try to decrypt the first block with known keys
from Crypto.Cipher import AES

# The PS4 PUP master key
master_key = bytes([0x2C, 0xFE, 0x94, 0xE1, 0xD0, 0xFA, 0x4E, 0xF5, 0x9C, 0xDF, 0x0B, 0x6E, 0x13, 0xA7, 0x98, 0x2C])

# The header is 0x20 bytes, the rest is encrypted
# Try to decrypt the data after the header
header_size = 0x20
encrypted_data = data[header_size:header_size+0x1000]

# Try different IVs
for iv_name, iv in [("first 16", encrypted_data[:16]), ("zeros", bytes(16))]:
    try:
        cipher = AES.new(master_key, AES.MODE_CBC, iv)
        dec = cipher.decrypt(encrypted_data[:64])
        # Check for known patterns
        if dec[:4] == b"SLB2" or dec[:4] == b"\x7fELF":
            print(f"\nFOUND with IV={iv_name}!")
        # Check entropy
        entropy = sum(1 for b in dec if b != 0)
        print(f"  IV={iv_name}: first 16={dec[:16].hex()}, non-zero={entropy}")
    except Exception as e:
        print(f"  Error {iv_name}: {e}")

