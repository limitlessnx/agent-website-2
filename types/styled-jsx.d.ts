import "react";

declare module "react" {
  // The upstream interface is generic; the parameter is required for declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface StyleHTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}

export {};
