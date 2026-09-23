// Types for `react-test-renderer`, written here instead of installed.
//
// `@types/react-test-renderer` would be a second package for a handful of signatures, and the
// package itself is deprecated upstream in React 19 — adding types for it would be adding a
// dependency to something that is already on its way out. This covers exactly what the render
// tests use and nothing else, so `any` never leaks into them.
declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  /** One node of the rendered tree, as `toJSON` returns it. */
  export type ReactTestRendererJSON = {
    type: string;
    props: Record<string, unknown>;
    children: (ReactTestRendererJSON | string)[] | null;
  };

  export type ReactTestInstance = {
    type: unknown;
    props: Record<string, any>;
    parent: ReactTestInstance | null;
    children: (ReactTestInstance | string)[];
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
    findAllByType(type: unknown): ReactTestInstance[];
  };

  export type ReactTestRenderer = {
    toJSON(): ReactTestRendererJSON | null;
    root: ReactTestInstance;
    update(element: ReactElement): void;
    unmount(): void;
  };

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): void;

  const TestRenderer: { create: typeof create; act: typeof act };
  export default TestRenderer;
}
