export interface ResponseDTO<T> {
    data: T,
    pagination: Paginacao
}
export interface Paginacao {
    page: number;
    pageSize: number;
    total: number;
}