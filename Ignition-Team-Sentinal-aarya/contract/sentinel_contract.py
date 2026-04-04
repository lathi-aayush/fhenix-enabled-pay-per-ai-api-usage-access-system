"""
SentinelAI deposit contract (Algorand Python / Puya).
Compile: puya compile sentinel_contract.py -o artifacts
Requires: algopy (see contract/requirements.txt)
"""

from algopy import ARC4Contract, Global, StateTotals, UInt64, gtxn
import algopy.arc4 as arc4


class SentinelContract(
    ARC4Contract,
    state_totals=StateTotals(global_uints=3, global_bytes=0),
):
    """Accepts grouped Payment + App call; tracks purchases and ALGO received in global state."""

    def __init__(self) -> None:
        self.min_payment = UInt64(0)
        self.total_purchases = UInt64(0)
        self.total_algo_received = UInt64(0)

    @arc4.abimethod(create="require")
    def create_application(self, min_amount: arc4.UInt64) -> None:
        """Set minimum payment (microAlgos) on deploy."""
        self.min_payment = min_amount.native
        self.total_purchases = UInt64(0)
        self.total_algo_received = UInt64(0)

    @arc4.abimethod
    def purchase(self, pay: gtxn.PaymentTransaction) -> None:
        """Process a valid top-up: Payment txn must be in the atomic group (reference arg)."""
        assert pay.receiver == Global.current_application_address, "receiver must be app account"
        assert pay.amount >= self.min_payment, "below minimum"
        self.total_purchases += UInt64(1)
        self.total_algo_received += pay.amount

    @arc4.abimethod(readonly=True)
    def read_stats(self) -> tuple[arc4.UInt64, arc4.UInt64, arc4.UInt64]:
        """Return (min_payment, total_purchases, total_algo_received_micro)."""
        return (
            arc4.UInt64(self.min_payment),
            arc4.UInt64(self.total_purchases),
            arc4.UInt64(self.total_algo_received),
        )
