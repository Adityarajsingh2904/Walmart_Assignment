import numpy as np
from sklearn.ensemble import IsolationForest
import joblib
from pathlib import Path


def main() -> None:
    rng = np.random.RandomState(42)
    X = rng.normal(size=(200, 32))
    clf = IsolationForest(n_estimators=10, random_state=42)
    clf.fit(X)
    Path('models').mkdir(exist_ok=True)
    joblib.dump(clf, 'models/isolation_forest.joblib')


if __name__ == '__main__':
    main()
