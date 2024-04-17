import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator"

export class CrawlChapterDTO {

    @IsString()
    @IsNotEmpty()
    bookUrl: string

    @IsString()
    @IsOptional()
    @IsIn(["nettruyen", "manhuavn", "truyenqq"])
    type: "nettruyen" | "manhuavn" | "truyenqq"

    @IsNumber()
    @IsOptional()
    take: number
} 