import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export function OriaLogo({ size = 40, color = '#8B7CFF' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Circle cx={20} cy={20} r={15.5} stroke={color} strokeWidth={2.8} />
      <Path
        d="M12.5 23.6 L20 15.4 L27.5 23.6"
        stroke={color}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
