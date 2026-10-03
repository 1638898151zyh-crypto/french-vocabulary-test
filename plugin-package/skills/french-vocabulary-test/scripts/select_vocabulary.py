"""Read the bundled vocabulary and filter by unit/part without modifying it."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="筛选内置 Édito B1 2023 词库，保留全部来源字段。")
    parser.add_argument("--unit", type=int, nargs="+", choices=range(1, 13))
    parser.add_argument("--part", type=int, nargs="+", choices=(1, 2))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    bank_path = Path(__file__).resolve().parents[1] / "assets" / "edito-b1-2023.json"
    bank = json.loads(bank_path.read_text(encoding="utf-8"))
    selected = [row for row in bank
                if (args.unit is None or int(row["unite"]) in args.unit)
                and (args.part is None or int(row["partie"]) in args.part)]
    text = json.dumps(selected, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
