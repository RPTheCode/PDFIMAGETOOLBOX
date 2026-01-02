import {
  BannerAd,
  BannerAdSize,
  TestIds,
  AdEventType,
  InterstitialAd,
} from 'react-native-google-mobile-ads';

export const BANNER_AD_ID = __DEV__ ? TestIds.BANNER : 'ca-app-pub-6543570376501942/4613719690';

export const INTERSTITIAL_AD_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-6543570376501942/7619156981';