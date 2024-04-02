import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator"

export class CrawlChapterDTO {

    @IsString()
    @IsNotEmpty()
    bookUrl: string

    @IsString()
    @IsOptional()
    @IsIn(["nettruyen"])
    type: "nettruyen"

    @IsNumber()
    @IsOptional()
    take: number
} 