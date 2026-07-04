// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { FHE, euint64, ebool } from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import { InEuint64 } from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

/**
 * SentinelPayment — FHE-enabled pay-per-AI-call settlement contract.
 *
 * Users deposit ETH which is tracked as an encrypted euint64 balance (in wei).
 * The backend operator deducts encrypted amounts per AI API call via deductForCall().
 * Users can only see their own balance by sealing it with a permit.
 *
 * Deployed on Sepolia (chainId 11155111).
 */
contract SentinelPayment {
    address public owner;

    // Encrypted balance per user (wei). Never readable without a permit.
    mapping(address => euint64) private _balances;

    // Tracks whether a user has an encrypted balance handle
    mapping(address => bool) private _hasBalance;

    // Per-service stats — total encrypted call count (indicator only, not amount)
    mapping(address => uint256) public serviceCallCount;

    // Minimum deposit in wei (set on deploy, owner-adjustable)
    uint256 public minDepositWei;

    // Total deposits received (plaintext — for treasury accounting only)
    uint256 public totalDepositsWei;

    event Deposited(address indexed user, uint256 indicatedWei);
    event CallDeducted(address indexed user, address indexed service, uint256 callIndex);
    event Withdrawn(address indexed owner, uint256 amount);

    error InsufficientDeposit(uint256 sent, uint256 minimum);
    error NotOwner();
    error ZeroBalance();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(uint256 _minDepositWei) {
        owner = msg.sender;
        minDepositWei = _minDepositWei;
    }

    /**
     * Deposit ETH — stored as an encrypted euint64 balance.
     * Amount is public here (msg.value is always visible on-chain);
     * deductions via deductForCall() remain encrypted.
     */
    function deposit() external payable {
        if (msg.value < minDepositWei) {
            revert InsufficientDeposit(msg.value, minDepositWei);
        }

        euint64 amount = FHE.asEuint64(msg.value);

        if (_hasBalance[msg.sender]) {
            _balances[msg.sender] = FHE.add(_balances[msg.sender], amount);
        } else {
            _balances[msg.sender] = amount;
            _hasBalance[msg.sender] = true;
        }

        // Grant user access to read their own balance
        FHE.allowThis(_balances[msg.sender]);
        FHE.allowSender(_balances[msg.sender]);

        totalDepositsWei += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * Deduct an encrypted amount from a user's balance for an AI call.
     * Called by the backend operator after verifying the AI request.
     * The amount is encrypted before submission via the CoFHE SDK on the backend.
     *
     * @param user        The user whose balance to deduct from
     * @param encAmount   Encrypted amount in wei (from @cofhe/sdk Encryptable.uint64)
     * @param service     The service/creator address (for call tracking)
     */
    function deductForCall(
        address user,
        InEuint64 calldata encAmount,
        address service
    ) external onlyOwner {
        require(_hasBalance[user], "No balance");

        euint64 amount = FHE.asEuint64(encAmount);
        _balances[user] = FHE.sub(_balances[user], amount);

        // Re-grant access after mutation
        FHE.allowThis(_balances[user]);
        FHE.allow(_balances[user], user);

        serviceCallCount[service] += 1;
        emit CallDeducted(user, service, serviceCallCount[service]);
    }

    /**
     * Returns the sealed (re-encrypted) balance for the caller.
     * Frontend unseals this using cofhejs.unseal(result, FheTypes.Uint64).
     */
    function sealedBalance() external view returns (euint64) {
        require(_hasBalance[msg.sender], "No balance");
        return _balances[msg.sender];
    }

    /**
     * Check if user has a balance (plaintext bool — safe to expose).
     */
    function hasBalance(address user) external view returns (bool) {
        return _hasBalance[user];
    }

    /**
     * Owner withdraws ETH from contract (platform fees / treasury).
     */
    function withdraw(uint256 amount) external onlyOwner {
        payable(owner).transfer(amount);
        emit Withdrawn(owner, amount);
    }

    /**
     * Owner updates minimum deposit.
     */
    function setMinDeposit(uint256 _minWei) external onlyOwner {
        minDepositWei = _minWei;
    }

    receive() external payable {
        // Accept plain ETH transfers (e.g. from facilitator)
    }
}
