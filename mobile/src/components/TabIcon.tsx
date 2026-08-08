import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

interface Props {
  name: 'chat' | 'scores' | 'follows' | 'profile';
  focused: boolean;
  color: string;
}

export function TabIcon({ name, focused, color }: Props) {
  const sw = focused ? 2.4 : 2;
  const fill = focused ? '#EEEDFA' : 'none';

  switch (name) {
    case 'chat':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M4 5h16v11H9l-4 4z" stroke={color} strokeWidth={sw} strokeLinejoin="round" fill={fill} />
        </Svg>
      );
    case 'scores':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <G>
            <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={sw} fill={fill} />
            <Path d="M8 5v14M16 5v14" stroke={color} strokeWidth={sw} />
          </G>
        </Svg>
      );
    case 'follows':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z"
            stroke={color}
            strokeWidth={sw}
            strokeLinejoin="round"
            fill={fill}
          />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <G>
            <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={sw} fill={fill} />
            <Path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />
          </G>
        </Svg>
      );
  }
}
