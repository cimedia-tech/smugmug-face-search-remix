import axios from "axios";

export interface SmugMugUser {
  NickName: string;
  RealName: string;
  WebUri: string;
  Uri?: string;
  Uris?: {
    Galleries?: {
      Uri: string;
    }
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
    }
  }
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

const getAuthHeaders = (creds?: SmugMugCredentials) => {
  if (!creds) return { "Accept": "application/json" };
  return {
    "X-SmugMug-Api-Key": creds.apiKey,
    "X-SmugMug-Api-Secret": creds.apiSecret,
    "X-SmugMug-Access-Token": creds.accessToken || "",
    "X-SmugMug-Access-Token-Secret": creds.accessTokenSecret || "",
    "Accept": "application/json",
  };
};

export const smugmug = {
  async getUser(creds?: SmugMugCredentials): Promise<SmugMugUser> {
    const response = await axios.get("/api/smugmug/api/v2/!authuser", {
      headers: getAuthHeaders(creds),
      params: { _accept: "application/json", _expand: "Galleries" }
    });
    const user = response.data.Response.User;
    // If galleries were expanded, they will be in response.data.Expansions
    if (response.data.Expansions && response.data.Expansions[user.Uri + "!galleries"]) {
      user.Galleries = response.data.Expansions[user.Uri + "!galleries"].Gallery;
    }
    return user;
  },

  async getGalleries(nickNameOrUri: string, creds?: SmugMugCredentials): Promise<SmugMugGallery[]> {
    let path = nickNameOrUri;
    if (!path.startsWith("/api/v2/")) {
      path = `/api/v2/user/${nickNameOrUri}!galleries`;
    }
    
    // Use the path as is, but ensure it's clean for the proxy
    const response = await axios.get(`/api/smugmug${path}`, {
      headers: getAuthHeaders(creds),
      params: { _accept: "application/json" }
    });
    return response.data.Response.Gallery;
  },

  async getGalleryImages(galleryUriOrImagesUri: string, creds?: SmugMugCredentials): Promise<SmugMugImage[]> {
    let path = galleryUriOrImagesUri;
    if (!path.includes("!images")) {
      path = `${path}!images`;
    }

    const response = await axios.get(`/api/smugmug${path}`, {
      headers: getAuthHeaders(creds),
      params: { _accept: "application/json" }
    });
    return response.data.Response.Image;
  },

  async getImageDetails(imageUri: string, creds?: SmugMugCredentials): Promise<SmugMugImage> {
    const response = await axios.get(`/api/smugmug${imageUri}`, {
      headers: getAuthHeaders(creds),
      params: { _accept: "application/json" }
    });
    return response.data.Response.Image;
  }
};
