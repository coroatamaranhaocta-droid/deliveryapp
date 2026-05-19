# Security Specification for Lanchonete Bom Sabor

## Data Invariants
- An order must have at least one item.
- An order's total must match the sum of its items' (price * quantity).
- `createdAt` must be set to the server time on creation and cannot be modified.
- `status` can only be updated in a logical sequence.
- Users can create orders anonymously or while logged in.
- If a user is logged in, their `userId` must match their UID and cannot be changed.
- Customers can only read their own orders (if logged in) or specific orders via ID if we implemented a tracking feature (but for now, let's stick to simple creation).

## The "Dirty Dozen" Payloads (Attack Vectors)

1. **Identity Spoofing**: Creating an order with a `userId` that belongs to another user.
2. **Price Manipulation**: Creating an order with a `total` of 0.01 regardless of items.
3. **Ghost Fields**: Adding an `isAdmin: true` field to the order document.
4. **Status Shortcutting**: Updating an order from `pending_confirmation` directly to `delivered`.
5. **Timestamp Tampering**: Setting `createdAt` to a date in the past or future.
6. **Immutable Field Update**: Attempting to change the `orderType` after the order is created.
7. **Resource Poisoning**: Injecting a 1MB string into the `customerName`.
8. **Orphaned Write**: Creating an order with an invalid `paymentMethod` not in the enum.
9. **State Locking Bypass**: Trying to update a `cancelled` order.
10. **Unauthenticated Admin Access**: Trying to delete an order without being an admin.
11. **PII Leak**: An authenticated user trying to list all orders in the collection.
12. **Malicious ID**: Creating an order with a path containing special characters to exploit potential injection.

## Test Cases (Expected Denials)
- `create` with `userId` mismatch.
- `create` with invalid `total`.
- `update` of `createdAt`.
- `update` of `status` by a non-admin (usually only staff can update status).
- `list` orders as a random user.
