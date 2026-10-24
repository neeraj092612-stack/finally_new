"""Tests for PriceCache."""

from app.market.cache import PriceCache


class TestPriceCache:
    """Unit tests for the PriceCache."""

    def test_update_and_get(self):
        """Test updating and getting a price."""
        cache = PriceCache()
        update = cache.update("AAPL", 190.50)
        assert update.ticker == "AAPL"
        assert update.price == 190.50
        assert cache.get("AAPL") == update

    def test_first_update_is_flat(self):
        """Test that the first update has flat direction."""
        cache = PriceCache()
        update = cache.update("AAPL", 190.50)
        assert update.direction == "flat"
        assert update.previous_price == 190.50

    def test_direction_up(self):
        """Test price update with upward direction."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        update = cache.update("AAPL", 191.00)
        assert update.direction == "up"
        assert update.change == 1.00

    def test_direction_down(self):
        """Test price update with downward direction."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        update = cache.update("AAPL", 189.00)
        assert update.direction == "down"
        assert update.change == -1.00

    def test_remove(self):
        """Test removing a ticker from cache."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.remove("AAPL")
        assert cache.get("AAPL") is None

    def test_remove_nonexistent(self):
        """Test removing a ticker that doesn't exist."""
        cache = PriceCache()
        cache.remove("AAPL")  # Should not raise

    def test_get_all(self):
        """Test getting all prices."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.update("GOOGL", 175.00)
        all_prices = cache.get_all()
        assert set(all_prices.keys()) == {"AAPL", "GOOGL"}

    def test_version_increments(self):
        """Test that version counter increments."""
        cache = PriceCache()
        v0 = cache.version
        cache.update("AAPL", 190.00)
        assert cache.version == v0 + 1
        cache.update("AAPL", 191.00)
        assert cache.version == v0 + 2

    def test_get_price_convenience(self):
        """Test the convenience get_price method."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)
        assert cache.get_price("AAPL") == 190.50
        assert cache.get_price("NOPE") is None

    def test_len(self):
        """Test __len__ method."""
        cache = PriceCache()
        assert len(cache) == 0
        cache.update("AAPL", 190.00)
        assert len(cache) == 1
        cache.update("GOOGL", 175.00)
        assert len(cache) == 2

    def test_contains(self):
        """Test __contains__ method."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        assert "AAPL" in cache
        assert "GOOGL" not in cache

    def test_custom_timestamp(self):
        """Test updating with a custom timestamp."""
        cache = PriceCache()
        custom_ts = 1234567890.0
        update = cache.update("AAPL", 190.50, timestamp=custom_ts)
        assert update.timestamp == custom_ts

    def test_price_rounding(self):
        """Test that prices are rounded to 2 decimal places."""
        cache = PriceCache()
        update = cache.update("AAPL", 190.12345)
        assert update.price == 190.12

    def test_remove_present_ticker_bumps_version(self):
        """Removing a cached ticker bumps the version by exactly 1."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        v = cache.version
        cache.remove("AAPL")
        assert cache.version == v + 1

    def test_remove_absent_ticker_leaves_version(self):
        """Removing an unknown ticker does not bump the version."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        v = cache.version
        cache.remove("NOPE")
        assert cache.version == v

    def test_zero_timestamp_is_kept(self):
        """A timestamp of 0.0 is a real value, not 'missing'."""
        cache = PriceCache()
        assert cache.update("X", 10.0, timestamp=0.0).timestamp == 0.0


class TestRawPriceDirection:
    """D-06: direction and change follow the raw price, not the 2 dp display price."""

    def test_sub_cent_move_up_is_up(self):
        """190.001 -> 190.003 displays as 190.00 both times but is an uptick."""
        cache = PriceCache()
        cache.update("X", 190.001)
        update = cache.update("X", 190.003)
        assert update.price == 190.00
        assert update.previous_price == 190.00
        assert update.direction == "up"
        assert update.change > 0

    def test_sub_cent_move_down_is_down(self):
        """A sub-cent fall is a downtick."""
        cache = PriceCache()
        cache.update("X", 190.003)
        update = cache.update("X", 190.001)
        assert update.direction == "down"
        assert update.change < 0

    def test_identical_raw_price_is_flat(self):
        """Flat only when the raw price truly did not change."""
        cache = PriceCache()
        cache.update("X", 190.003)
        update = cache.update("X", 190.003)
        assert update.direction == "flat"
        assert update.change == 0.0

    def test_display_price_rounded_at_cache(self):
        """The cache, not the simulator, rounds the display price to 2 dp."""
        cache = PriceCache()
        assert cache.update("X", 190.1234).price == 190.12


class TestReferencePrice:
    """D-18: day-change baseline carried by the cache."""

    def test_first_update_sets_reference(self):
        """The first price becomes the baseline; day change is exactly 0.0."""
        cache = PriceCache()
        update = cache.update("X", 190.0)
        assert update.direction == "flat"
        assert update.reference_price == 190.0
        assert update.day_change_percent == 0.0

    def test_later_updates_keep_first_baseline(self):
        """Without an explicit reference the first baseline is carried forward."""
        cache = PriceCache()
        cache.update("X", 190.0)
        update = cache.update("X", 191.24)
        assert update.reference_price == 190.0
        assert update.day_change_percent == 0.65

    def test_explicit_reference_replaces_baseline(self):
        """An explicit reference_price overrides the carried one."""
        cache = PriceCache()
        cache.update("X", 190.0)
        update = cache.update("X", 191.24, reference_price=180.0)
        assert update.reference_price == 180.0
        assert update.day_change_percent == round((191.24 - 180.0) / 180.0 * 100, 2)

    def test_explicit_reference_on_first_update(self):
        """A source-supplied reference wins on the very first update too."""
        cache = PriceCache()
        update = cache.update("X", 191.24, reference_price=190.0)
        assert update.reference_price == 190.0
        assert update.day_change_percent == 0.65

    def test_zero_reference_yields_none(self):
        """A zero reference never divides by zero; day_change_percent is None."""
        cache = PriceCache()
        cache.update("X", 190.0)
        update = cache.update("X", 191.24, reference_price=0)
        assert update.day_change_percent is None

    def test_reference_stored_rounded(self):
        """reference_price is stored at 2 dp."""
        cache = PriceCache()
        update = cache.update("X", 190.0, reference_price=189.987)
        assert update.reference_price == 189.99
