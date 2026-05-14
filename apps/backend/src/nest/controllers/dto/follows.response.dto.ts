/** Takip işlemleri yanıt DTO'su */
export class FollowsResponseDto {
  ok!: boolean;
  follows?: Array<{ educatorId?: string; followType?: string; notificationsEnabled?: boolean }>;
}
