import { apiRequest } from '../../services/api/client';
export type ShopOnboarding = {shop_name:string;slogan?:string;category:string;phone:string;city:string;address?:string;commission_passthrough?:boolean;latitude?:number;longitude?:number};
export type Shop = ShopOnboarding & {id:string;status?:string;kyc_status?:string};
export const sellerOnboardingApi = {
  // GET /vendor/shop (src/routes/compatibility.js) — every vendor account
  // already has a row here from registration (shop_name only); used to
  // pre-fill this screen instead of always starting blank.
  getShop: () => apiRequest<Shop>('/vendor/shop'),
  submit: (payload: ShopOnboarding) => apiRequest<any>('/vendor/shop',{method:'PATCH',body:JSON.stringify(payload)}),
};
