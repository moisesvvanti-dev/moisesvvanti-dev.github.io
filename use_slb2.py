import sys
sys.path.insert(0, "PFU-PupFileUnpacker/src")
from core.slb2_file import SLB2File

slb2 = SLB2File("PS4UPDATE.PUP")
if slb2.load():
    print("SLB2 loaded successfully!")
    print(f"Version: {slb2.version}")
    print(f"Flags: {slb2.flags}")
    print(f"Entries: {len(slb2.entries)}")
    
    for i, entry in enumerate(slb2.entries):
        print(f"\nEntry {i}:")
        print(f"  Name: {entry['name']}")
        print(f"  Start sector: {entry['start_sector']}")
        print(f"  Size: {entry['size']} bytes")
        print(f"  Offset: {entry['offset']:#x}")
        
        # Extract this entry
        slb2.extract_entry(i, f"pup_extracted/{entry['name']}")
else:
    print("Failed to load SLB2 file")
