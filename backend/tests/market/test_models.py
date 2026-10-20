"""Tests for PriceUpdate dataclass."""

import pytest

from app.market.models import PriceUpdate


class TestPriceUpdate:
    """Unit tests for the PriceUpdate model."""

    def test_price_update_creation(self):
        """Test basic PriceUpdate creation."""
        update = PriceUpdate(ticker="AAPL", price=190.50, previous_price=190.00, timestamp=1234567890.0)
        assert update.ticker == "AAPL"
        assert update.price == 190.50
        assert update.previous_price == 190.00
        assert update.timestamp == 1234567890.0

    def test_change_calculation(self):
        """Test price change calculation."""
        update = PriceUpdate(ticker="AAPL", price=190.50, previous_price=190.00, timestamp=1234567890.0)
        assert update.change == 0.50

    def test_change_negative(self):
        """Test negative price change."""
        update = PriceUpdate(ticker="AAPL", price=189.50, previous_price=190.00, timestamp=1234567890.0)
        assert update.change == -0.50

    def test_change_percent_up(self):
        """Test percentage change calculation (up)."""
        update = PriceUpdate(ticker="AAPL", price=190.00, previous_price=100.00, timestamp=1234567890.0)
        assert update.change_percent == 90.0

    def test_change_percent_down(self):
        """Test percentage change calculation (down)."""
        update = PriceUpdate(ticker="AAPL", price=100.00, previous_price=200.00, timestamp=1234567890.0)
        assert update.change_percent == -50.0

    def test_change_percent_zero_previous(self):
        """Test percentage change with zero previous price."""
        update = PriceUpdate(ticker="AAPL", price=100.00, previous_price=0.00, timestamp=1234567890.0)
        assert update.change_percent == 0.0

    def test_direction_up(self):
        """Test direction calculation (up)."""
        update = PriceUpdate(ticker="AAPL", price=191.00, previous_price=190.00, timestamp=1234567890.0)
        assert update.direction == "up"

    def test_direction_down(self):
        """Test direction calculation (down)."""
        update = PriceUpdate(ticker="AAPL", price=189.00, previous_price=190.00, timestamp=1234567890.0)
        assert update.direction == "down"

    def test_direction_flat(self):
        """Test direction calculation (flat)."""
        update = PriceUpdate(ticker="AAPL", price=190.00, previous_price=190.00, timestamp=1234567890.0)
        assert update.direction == "flat"

    def test_to_dict(self):
        """Test serialization to dictionary."""
        update = PriceUpdate(ticker="AAPL", price=190.50, previous_price=190.00, timestamp=1234567890.0)
        result = update.to_dict()

        assert result["ticker"] == "AAPL"
        assert result["price"] == 190.50
        assert result["previous_price"] == 190.00
        assert result["timestamp"] == 1234567890.0
        assert result["change"] == 0.50
        assert result["change_percent"] == 0.2632  # (0.50 / 190.00) * 100
        assert result["direction"] == "up"

    def test_immutability(self):
        """Test that PriceUpdate is immutable."""
        update = PriceUpdate(ticker="AAPL", price=190.50, previous_price=190.00, timestamp=1234567890.0)

        with pytest.raises(AttributeError):
            update.price = 200.00  # Should raise error


class TestPriceUpdateExtensions:
    """D-06 raw-price direction and D-18 day-change fields."""

    def test_defaults_keep_old_behavior(self):
        """Without raw or reference fields, behavior is computed from price fields."""
        update = PriceUpdate(ticker="AAPL", price=191.0, previous_price=190.0, timestamp=1.0)
        assert update.reference_price is None
        assert update.day_change_percent is None
        assert update.direction == "up"

    def test_direction_uses_raw_prices_when_present(self):
        """Equal display prices but a raw uptick report 'up'."""
        update = PriceUpdate(
            ticker="X", price=190.0, previous_price=190.0, timestamp=1.0,
            raw_price=190.003, raw_previous_price=190.001,
        )
        assert update.direction == "up"
        assert update.change > 0
        assert update.change_percent > 0

    def test_direction_flat_when_raw_equal(self):
        """Equal raw prices are flat."""
        update = PriceUpdate(
            ticker="X", price=190.0, previous_price=190.0, timestamp=1.0,
            raw_price=190.003, raw_previous_price=190.003,
        )
        assert update.direction == "flat"
        assert update.change == 0.0

    def test_day_change_percent(self):
        """190.00 -> 191.24 against a 190.00 reference is 0.65 percent."""
        update = PriceUpdate(
            ticker="X", price=191.24, previous_price=191.0, timestamp=1.0, reference_price=190.0
        )
        assert update.day_change_percent == 0.65

    def test_day_change_percent_none_for_zero_reference(self):
        """A zero reference yields None."""
        update = PriceUpdate(
            ticker="X", price=191.24, previous_price=191.0, timestamp=1.0, reference_price=0.0
        )
        assert update.day_change_percent is None

    def test_to_dict_has_exactly_nine_keys(self):
        """to_dict carries the 7 original keys plus the two additive ones, never raw fields."""
        update = PriceUpdate(
            ticker="X", price=190.0, previous_price=190.0, timestamp=1.0,
            raw_price=190.003, raw_previous_price=190.001, reference_price=189.0,
        )
        result = update.to_dict()
        assert set(result) == {
            "ticker", "price", "previous_price", "timestamp", "change",
            "change_percent", "direction", "reference_price", "day_change_percent",
        }
        assert result["reference_price"] == 189.0
        assert result["day_change_percent"] == round((190.0 - 189.0) / 189.0 * 100, 2)
        assert "raw_price" not in result
        assert "raw_previous_price" not in result
