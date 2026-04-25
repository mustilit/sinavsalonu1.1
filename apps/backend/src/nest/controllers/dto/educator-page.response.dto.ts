/** Eğitici profil sayfası yanıt DTO'su */
export class EducatorPageResponseDto {
  id!: string;
  name?: string;
  bio?: string;
  stats?: { testsCount?: number; rating?: number };
}
