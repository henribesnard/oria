interface OriaLogoProps {
  size?: number;
  color?: string;
}

export default function OriaLogo({ size = 30, color = "#5B4FD6" }: OriaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="15.5" stroke={color} strokeWidth="2.8" />
      <path
        d="M12.5 23.6 L20 15.4 L27.5 23.6"
        stroke={color}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
