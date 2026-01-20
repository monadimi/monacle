/**
 * @file app/actions/cowork.ts
 * @purpose Aggregator for Cowork Server Actions.
 * @scope Re-exports domain-specific actions for Forms, Docs, Boards, and Slides to maintain backward compatibility.
 * @failure-behavior N/A (Delegates to individual modules).
 */

export * from "./forms";
export * from "./docs";
export * from "./boards";
export * from "./slides";
