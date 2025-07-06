import numpy as np
import tensorflow as tf
from pathlib import Path


def main() -> None:
    rng = np.random.RandomState(42)
    X = rng.normal(size=(50, 50, 32))
    inputs = tf.keras.Input(shape=(None, 32))
    encoded = tf.keras.layers.LSTM(16, return_sequences=True)(inputs)
    decoded = tf.keras.layers.LSTM(32, return_sequences=True)(encoded)
    model = tf.keras.Model(inputs, decoded)
    model.compile(optimizer="adam", loss="mse")
    model.fit(X, X, epochs=1, batch_size=10, verbose=0)
    export_path = 'models/lstm_encoder'
    Path(export_path).mkdir(parents=True, exist_ok=True)
    model.export(export_path)


if __name__ == '__main__':
    main()
