import {
  BannerAd,
  BannerAdSize,
  TestIds,
  AdEventType,
  InterstitialAd,
} from 'react-native-google-mobile-ads';

export const BANNER_AD_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-6543570376501942/4613719690';

export const INTERSTITIAL_AD_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-6543570376501942/7619156981';

export const BannerAdComponent = () => {
  return (
    <>
    <BannerAd
      unitId={BANNER_AD_ID}
      size={BannerAdSize.BANNER}
      requestOptions={{
        requestNonPersonalizedAdsOnly: true,
        keywords: [
          'pdf',
          'tools',
          'education',
          'documents',
          'images',
          'ebooks',
          'study',
          'learning',
          'tutorial',
          'books',
          'notes',
          'research',
          'classroom',
          'homework',
          'courses',
          'writing',
          'files',
          'scans',
          'printing',
          'office',
          'software',
          'productivity',
          'apps',
          'online courses',
          'technology',
          'learning resources',
          'digital library',
          'educational apps',
          'school',
          'college',
          'reference',
          'study materials',
          'pdf converter',
          'document editor',
          'image editor',
          'graphic design',
          'photography',
          'presentations',
          'reports',
          'articles',
        ],
      }}
      onAdLoaded={() => console.log('✅ Banner LOADED')}
      onAdFailedToLoad={error => console.log('❌ Banner ERROR:', error)}
      />
      </>
  );
};
