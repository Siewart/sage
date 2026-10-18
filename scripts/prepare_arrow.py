"""Optional bounded-memory preparation for large Arrow IPC files (pip install pyarrow)."""
import argparse
import json
from pathlib import Path
import pyarrow as pa
import pyarrow.ipc as ipc
import pyarrow.parquet as pq

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("descriptor", type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
descriptor = json.loads(args.descriptor.read_text())
args.output.mkdir(parents=True, exist_ok=True)
for group in ("dictionaries", "binned", "windowed", "series", "records"):
    for entry in descriptor.get(group, []):
        source = args.descriptor.parent / entry["path"]
        target = args.output / (entry["type"] + ".parquet")
        partial = target.with_suffix(".parquet.partial")
        if source.suffix == ".parquet":
            entry["path"] = str(source.resolve())
            continue
        with pa.memory_map(str(source), "r") as mapped:
            reader = ipc.open_file(mapped)
            with pq.ParquetWriter(partial, reader.schema, compression="zstd") as writer:
                for index in range(reader.num_record_batches):
                    batch = reader.get_batch(index)
                    for start in range(0, batch.num_rows, 65536):
                        writer.write_batch(batch.slice(start, 65536))
        partial.replace(target)
        entry["path"] = target.name
(args.output / "descriptor.json").write_text(json.dumps(descriptor, indent=2))
