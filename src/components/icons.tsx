import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 3H2v12h6" />
      <path d="M10 3v12" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M22 15H10" />
      <path d="M16 9.5a4.5 4.5 0 1 1-8.2-2.5" />
    </svg>
  );
}
