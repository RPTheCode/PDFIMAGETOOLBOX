import { Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 813;

const scale = size => (width / guidelineBaseWidth) * size;
const verticalScale = size => (height / guidelineBaseHeight) * size;
const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

export { scale, verticalScale, moderateScale,  };

export const DEVICE_STYLES = {
  SCREEN_WIDTH: width,
  SCREEN_HEIGHT: height,
};

export const platform = Platform;

export const Color = {
  Purple: '#9C27B0',
  // Purple: '#ec3bf5',
  White: '#FFFFFF',
  Black: '#000000',
  SilverGray: '#9D9999',
  DarkBlue: '#1828d3ff',
  Blue2: '#1E90FF',
  DefaultColor: '#dfdabdff',
  tealGreen: '#03A685',
  Red2: '#FF2222',
  

  GREEN: '#34A853',

  Black1: '#1D1D1D',
  Black2: '#222222',
  Gray: '#666464',
  LightGray: '#F1F1F1',
  Red: '#FF3F4C',
  Red1: '#CE2727',
  LightGray1: '#D9D9D9',
  LightGray2: '#8D8C8C',
  LightGray3: '#8B8B8B',
  LightGray4: '#2F2F2F',
  LightGray5: '#888888',
  LightGray6: '#7b7b7b',
  BorderColor: '#E6E6E6',
  SkyBlue: '#D1ECFF',
  BannerskyBlue: '#E3FCFF',
  lightGray7: '#EAEAEA',
};
