// functions/src/index.ts
// Central export file — all functions registered here

export { autoReleaseEscrow }      from "./autoReleaseEscrow"
export { autoResolveDisputes, triggerDisputeResolution } from "./autoResolveDisputes"
export { onListingWrite, bulkIndexListings } from "./algoliaSync"
export { onListingActivated }     from "./searchAlerts"
export { onOrderComplete }        from "./buyerBadges"

