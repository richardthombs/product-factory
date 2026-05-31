import type { CreateTestOptions, CreateTestResult } from "./createTest.js";
import { createTest } from "./createTest.js";

/**
 * @deprecated Use createTest instead.
 */
export type LinkAcceptanceCriterionTestOptions = CreateTestOptions;

/**
 * @deprecated Use createTest instead.
 */
export type LinkAcceptanceCriterionTestResult = CreateTestResult;

/**
 * @deprecated Use createTest instead.
 */
export async function linkAcceptanceCriterionTest(
  options: LinkAcceptanceCriterionTestOptions,
): Promise<LinkAcceptanceCriterionTestResult> {
  return createTest(options);
}
