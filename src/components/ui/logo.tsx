import * as React from "react"

export function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Stack / Database representing "Stack" */}
      <ellipse cx="9" cy="6" rx="7" ry="3" />
      <path d="M2 6v4c0 1.7 3.1 3 7 3 1.1 0 2.2-.1 3.1-.4" />
      <path d="M2 10v4c0 1.7 3.1 3 7 3 1.3 0 2.5-.2 3.5-.5" />
      <path d="M2 14v4c0 1.7 3.1 3 7 3 1.3 0 2.5-.2 3.5-.5" />
      {/* Magnifying Glass representing "Serp" */}
      <circle cx="17" cy="17" r="4" />
      <line x1="20" y1="20" x2="23" y2="23" />
    </svg>
  )
}
