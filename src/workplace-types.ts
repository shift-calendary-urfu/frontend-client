const stores = [
  { value: "gas_station", title: "Заправка (АЗС)" },
  { value: "grocery_store", title: "Продуктовый магазин" },
  { value: "clothing_store", title: "Магазин одежды" },
  { value: "tobacco_shop", title: "Табачный магазин" },
  { value: "pharmacy", title: "Аптека" },
  { value: "electronics_store", title: "Магазин электроники" },
  { value: "hardware_store", title: "Магазин стройматериалов" },
].map((type) => ({ ...type, group: "Магазины и АЗС" }));

const services = [
  { value: "cafe_restaurant", title: "Кафе или ресторан" },
  { value: "beauty_salon", title: "Салон красоты" },
  { value: "car_wash", title: "Автомойка" },
  { value: "warehouse", title: "Склад" },
].map((type) => ({ ...type, group: "Услуги и склады" }));

const pickupPoints = [
  { value: "ozon", title: "Ozon" },
  { value: "wildberries", title: "Wildberries" },
  { value: "yandex_market", title: "Яндекс Маркет" },
  { value: "cdek", title: "СДЭК" },
  { value: "russian_post", title: "Почта России" },
  { value: "five_post", title: "5Post" },
  { value: "lamoda", title: "Lamoda" },
  { value: "magnit_market", title: "Магнит Маркет" },
  { value: "megamarket", title: "Мегамаркет" },
  { value: "dpd", title: "DPD" },
  { value: "avito_delivery", title: "Авито Доставка" },
  { value: "pek", title: "ПЭК" },
  { value: "dellin", title: "Деловые Линии" },
  { value: "cse", title: "Курьер Сервис Экспресс" },
  { value: "l_post", title: "Л-Пост" },
  { value: "pickup_point", title: "Пункт выдачи заказов" },
].map((type) => ({ ...type, group: "Пункты выдачи" }));

export const workplaceTypes = [
  ...stores,
  ...services,
  ...pickupPoints,
  { value: "other", title: "Другой тип", group: "" },
];

export function workplaceTypeName(value: string) {
  return (
    workplaceTypes.find((type) => type.value === value)?.title ??
    (value || "Другой тип")
  );
}
