interface OriaLogoProps {
  size?: number;
  /** Fill color for the tiny center circle — should match the background */
  centerFill?: string;
}

export default function OriaLogo({ size = 30, centerFill = "#F6F6FB" }: OriaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="15.5" stroke="#5B4FD6" strokeWidth="2.8" />
      <path
        d="M20 8.5a11.5 11.5 0 0 1 0 23"
        stroke="#5B4FD6"
        strokeWidth="2.8"
        strokeLinecap="round"
        opacity=".36"
      />
      <circle cx="20" cy="20" r="4.2" fill="#5B4FD6" />
      <circle cx="20" cy="20" r="1.7" fill={centerFill} />
    </svg>
  );
}
