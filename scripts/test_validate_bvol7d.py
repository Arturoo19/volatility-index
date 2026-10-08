"""Checks that absent source minutes cannot produce apparently valid results."""
import unittest
from datetime import datetime, timedelta, timezone
from validate_bvol7d import N, evaluate, iso


class WindowIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.end = datetime(2025, 5, 1, tzinfo=timezone.utc)
        self.prices = {self.end - timedelta(minutes=i): 100.0 for i in range(N + 1)}
        self.official = [{'timestamp': iso(self.end), 'price': 0.0}]

    def test_complete_window(self):
        rows, metrics = evaluate(self.official, self.prices)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['calculated'], 0)
        self.assertEqual(metrics['invalid_windows'], 0)

    def test_missing_interior_minute_is_rejected(self):
        del self.prices[self.end - timedelta(minutes=42)]
        rows, metrics = evaluate(self.official, self.prices)
        self.assertEqual(rows, [])
        self.assertEqual(metrics['invalid_windows'], 1)

    def test_oldest_price_is_required(self):
        del self.prices[self.end - timedelta(minutes=N)]
        rows, metrics = evaluate(self.official, self.prices)
        self.assertEqual(rows, [])
        self.assertEqual(metrics['invalid_windows'], 1)

    def test_daily_window_does_not_require_older_weekly_prices(self):
        daily = {t: p for t, p in self.prices.items() if t >= self.end - timedelta(minutes=1440)}
        rows, metrics = evaluate(self.official, daily, window=1440)
        self.assertEqual(len(rows), 1)
        self.assertEqual(metrics['invalid_windows'], 0)
        del daily[self.end - timedelta(minutes=1440)]
        rows, metrics = evaluate(self.official, daily, window=1440)
        self.assertEqual(rows, [])
        self.assertEqual(metrics['invalid_windows'], 1)


if __name__ == '__main__':
    unittest.main()
