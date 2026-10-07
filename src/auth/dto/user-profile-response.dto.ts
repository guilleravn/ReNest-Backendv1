export class UserProfileResponseDto {
  id: string;
  email: string;
  fullName: string;
  city: string;
  phoneE164: string | null;
  isVerified: boolean;
}
