const sampleListings = [
  {
    title: "Royal Haveli on Lake Pichola",
    description:
      "Experience the grandeur of Rajasthan in this exquisitely restored haveli. Overlooking the serene Lake Pichola, this property offers breathtaking views of the City Palace and Jag Mandir. Each room is adorned with traditional art, offering a blend of heritage and modern luxury. Enjoy rooftop dinners under the stars with live folk music.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1596374072248-675c7170b0c2?auto=format&fit=crop&w=800&q=60",
    },
    price: 18000,
    location: "Udaipur",
    country: "India",
    category: "Mansions",
  },
  {
    title: "Cozy Wooden Cabin in Manali",
    description:
      "Escape to the Himalayas in this charming wooden cabin nestled amidst apple orchards. Wake up to the panoramic views of snow-capped peaks and the sound of the Beas River. The cabin features a cozy fireplace, a fully equipped kitchenette, and a private balcony. It's the perfect retreat for nature lovers and adventure seekers looking to explore Solang Valley.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1616056487593-2748726545a0?auto=format&fit=crop&w=800&q=60",
    },
    price: 8500,
    location: "Manali",
    country: "India",
    category: "Cabins",
  },
  {
    title: "Luxury Beachfront Villa in Goa",
    description:
      "Indulge in the ultimate coastal getaway at this luxurious villa in North Goa. With a private infinity pool that merges with the horizon of the Arabian Sea, this property is pure bliss. The villa boasts modern architecture, spacious living areas, and direct access to a pristine beach. It is ideal for families or groups seeking an exclusive and relaxing vacation.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1614562183129-a724b759a1c8?auto=format&fit=crop&w=800&q=60",
    },
    price: 25000,
    location: "Goa",
    country: "India",
    category: "Amazing pools",
  },
  {
    title: "Serene Houseboat in Alleppey",
    description:
      "Float through the tranquil backwaters of Kerala on a traditional Kettuvallam (houseboat). This unique accommodation offers an immersive experience of local life, passing by lush paddy fields and quaint villages. Enjoy freshly cooked Keralan cuisine prepared by the onboard chef. It's a peaceful journey that will rejuvenate your mind and soul.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1589920148410-8025211a268a?auto=format&fit=crop&w=800&q=60",
    },
    price: 12000,
    location: "Alleppey",
    country: "India",
    category: "Trending",
  },
  {
    title: "Riverside Luxury Camp in Rishikesh",
    description:
      "Experience the thrill of adventure and the serenity of nature at our luxury camp on the banks of the River Ganges. Each tent is equipped with comfortable beds and an attached washroom. Participate in morning yoga sessions, go for thrilling river rafting, and spend your evenings around a bonfire. This is glamping at its finest, with the Himalayas as your backdrop.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1577059916959-99a3897b5d1e?auto=format&fit=crop&w=800&q=60",
    },
    price: 6000,
    location: "Rishikesh",
    country: "India",
    category: "Camping",
  },
  {
    title: "Colonial Tea Estate Bungalow",
    description:
      "Step back in time at this elegant colonial bungalow set within a sprawling tea estate in Darjeeling. Enjoy breathtaking views of the Kanchenjunga mountain range right from your window. Spend your days walking through the tea gardens, learning about the tea-making process, and sipping the world's finest brew. This is a perfect escape from the hustle of city life.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1593973873464-321151e3ae5d?auto=format&fit=crop&w=800&q=60",
    },
    price: 10000,
    location: "Darjeeling",
    country: "India",
    category: "Amazing views",
  },
  {
    title: "Coffee Plantation Homestay in Coorg",
    description:
      "Wake up to the fresh aroma of coffee at this beautiful homestay in the heart of Coorg, the 'Scotland of India'. Surrounded by lush green coffee and spice plantations, this stay offers an authentic Kodava experience. Enjoy delicious home-cooked meals, go for bird-watching trails, and learn about coffee cultivation from your hosts. A truly organic and refreshing retreat.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1598353342337-b71324749d21?auto=format&fit=crop&w=800&q=60",
    },
    price: 7500,
    location: "Coorg",
    country: "India",
    category: "Farms",
  },
  {
    title: "Chic French Quarter Townhouse",
    description:
      "Immerse yourself in the charming colonial vibes of Puducherry with a stay at this vibrant townhouse. Located in the iconic White Town, the property features classic French architecture, arched doorways, and a beautiful courtyard. It is just a stone's throw away from the Promenade Beach and chic cafes. Explore the unique culture of this coastal town from the perfect base.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1563532290022-7f61c337a7b9?auto=format&fit=crop&w=800&q=60",
    },
    price: 9000,
    location: "Puducherry",
    country: "India",
    category: "Beach",
  },
  {
    title: "Modern Sea-View Apartment in Mumbai",
    description:
      "Stay in the heart of the 'City of Dreams' in this stylish apartment in Bandra. Offering stunning, uninterrupted views of the Arabian Sea, this space is designed for comfort and luxury. The location is perfect for exploring the vibrant nightlife, high-end boutiques, and famous eateries of the city. Witness spectacular sunsets from the comfort of your living room.",
    image: {
      filename: "listingimage",
      url: "https://plus.unsplash.com/premium_photo-1663126298953-e3c3b0186981?auto=format&fit=crop&w=800&q=60",
    },
    price: 15000,
    location: "Mumbai",
    country: "India",
    category: "Rooms",
  },
  {
    title: "Heritage Palace Hotel in Jaipur",
    description:
      "Live like a Maharaja in this opulent heritage palace, a jewel in the Pink City of Jaipur. The property boasts magnificent architecture, sprawling gardens, and a grand swimming pool. Each suite is a masterpiece of Rajasthani craftsmanship. The hotel is conveniently located near major attractions like Hawa Mahal and Amer Fort, offering a royal experience.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1598327105159-8d7b32a15345?auto=format&fit=crop&w=800&q=60",
    },
    price: 22000,
    location: "Jaipur",
    country: "India",
    category: "Mansions",
  },
   {
    title: "Mountain Lodge with Himalayan Views",
    description:
      "Perched on a hilltop in Leh, this lodge offers unparalleled 360-degree views of the Stok Kangri range and the vast Himalayan landscape. The rooms are designed with local materials and offer warmth and comfort in the high-altitude desert. It is an ideal base for acclimatization before you head out for treks and monastery tours. Experience the stark beauty of Ladakh.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1616525142823-530c3a463589?auto=format&fit=crop&w=800&q=60",
    },
    price: 11000,
    location: "Leh, Ladakh",
    country: "India",
    category: "Amazing views",
  },
  {
    title: "Jungle Safari Resort near Ranthambore",
    description:
      "Stay on the edge of the famous Ranthambore National Park in this luxury jungle resort. The property offers lavish tents and cottages with all modern amenities. Embark on thrilling safari drives to spot the majestic Royal Bengal Tiger in its natural habitat. The resort's design blends seamlessly with the surrounding wilderness, providing an authentic yet comfortable jungle experience.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1598141049007-a06846174d0e?auto=format&fit=crop&w=800&q=60",
    },
    price: 13500,
    location: "Ranthambore",
    country: "India",
    category: "Camping",
  },
];

module.exports = { data: sampleListings };