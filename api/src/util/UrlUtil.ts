export default class UrlUtil {
  public static getKey = (url: string) => {
    const key = url.split('.com/');
    return key[1];
  };
}
