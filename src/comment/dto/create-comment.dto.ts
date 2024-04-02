import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator"

export class CreateCommentDto {
    @IsNumber()
    @IsNotEmpty()
    bookId: number
    
    @IsNumber()
    @IsOptional()
    chapterNumber?: number

    @IsNumber()
    @IsOptional()
    parentId?: number
    
    @IsNumber()
    @IsOptional()
    receiverId?: number

    @IsString()
    @IsNotEmpty()
    commentText: string
} 
