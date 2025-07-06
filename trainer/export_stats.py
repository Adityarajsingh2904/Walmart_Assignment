import json
from pathlib import Path

STATS = {
    "mu_if": 0.12,
    "sigma_if": 0.04,
    "mu_lstm": 0.18,
    "sigma_lstm": 0.05,
    "min_raw": -3.0,
    "max_raw": 12.0,
}


def main() -> None:
    Path('models').mkdir(exist_ok=True)
    with open('models/if_stats.json', 'w') as f:
        json.dump(STATS, f)


if __name__ == '__main__':
    main()
