export interface SmugMugUser {
  NickName: string;
  RealName: string;
  WebUri: string;
  Uri?: string;
  Uris?: {
    Galleries?: {
      Uri: string;
    };
  };
  Galleries?: SmugMugGallery[];
}

export interface SmugMugGallery {
  Name: string;
  Uri: string;
  WebUri: string;
  Uris?: {
    GalleryImages?: {
      Uri: string;
    };
  };
}

export interface SmugMugImage {
  FileName: string;
  ThumbnailUrl: string;
  LargeImageUrl: string;
  Uri: string;
  WebUri: string;
}

export interface SmugMugCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
}

export interface FaceMatchResult {
  imageId: string;
  isMatch: boolean;
  confidence: number;
  reasoning?: string;
}
