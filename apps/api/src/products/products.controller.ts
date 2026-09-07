import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('active') active?: string,
  ) {
    return this.products.list({
      q,
      categoryId,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
      active: active === undefined ? undefined : active === 'true',
    });
  }

  @Get('search')
  search(@Query('q') q = '', @Query('take') take?: string) {
    return this.products.search(q, take ? Number(take) : 20);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }
}
