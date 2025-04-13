
import { useState } from "react";
import { Link } from "react-router-dom";
import { ProductCard } from "@/components/ProductCard";
import { Categories } from "@/components/Categories";
import { UserRound, ShoppingCart, Camera, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

async function fetchProducts(searchTerm = '') {
  let query = supabase
    .from('products')
    .select('*');
  
  if (searchTerm) {
    query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  if (data) {
    const hasSolarPowerBank = data.some(product => product.title.includes("Solar Power Bank"));
    
    if (!hasSolarPowerBank) {
      data.push({
        id: "solar-power-bank-001",
        title: "EcoCharge Solar Power Bank",
        description: "Portable 20000mAh solar power bank with fast charging capabilities. Perfect for outdoor activities and emergencies.",
        image_url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
        price: 49.99,
        sustainability_score: 9,
        eco_features: ["recyclable", "energy-efficient", "solar-powered"],
        brand: "EcoCharge",
        category: "Electronics",
        // Adding the missing required properties:
        carbon_footprint: 5.2,
        created_at: new Date().toISOString(),
        materials: ["recycled plastic", "silicon solar panels", "lithium-ion battery"],
        seller_id: null
      });
    }
  }
  
  return data;
}

async function fetchCartItemsCount() {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user) return 0;

  const { count, error } = await supabase
    .from('cart_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.session.user.id);

  if (error) return 0;
  return count || 0;
}

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("All Products");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products', searchTerm],
    queryFn: () => fetchProducts(searchTerm),
  });

  const { data: cartItemsCount = 0 } = useQuery({
    queryKey: ['cartItems'],
    queryFn: fetchCartItemsCount,
    refetchInterval: 5000,
  });

  const filteredProducts = selectedCategory === "All Products"
    ? products
    : products.filter(product => product.category === selectedCategory);

  if (isLoading) return <div className="min-h-screen bg-eco-background flex items-center justify-center"><p className="text-lg text-gray-600">Loading products...</p></div>;
  if (error) return <div className="min-h-screen bg-eco-background flex items-center justify-center"><p className="text-lg text-red-600">Error loading products. Please try again later.</p></div>;

  return (
    <div className="min-h-screen bg-eco-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-end items-center mb-6">
          <div className="flex gap-4">
            <Link 
              to="/scanner" 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-eco-primary text-white hover:bg-eco-primary/90 transition-colors"
            >
              <Camera size={20} />
              <span>Scanner</span>
            </Link>
            <Link 
              to="/cart" 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-eco-primary text-white hover:bg-eco-primary/90 transition-colors relative"
            >
              <ShoppingCart size={20} />
              <span>Cart</span>
              {cartItemsCount > 0 && (
                <Badge 
                  className="absolute -top-2 -right-2 bg-eco-accent text-white"
                  variant="secondary"
                >
                  {cartItemsCount}
                </Badge>
              )}
            </Link>
            <Link 
              to="/profile" 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-eco-primary text-white hover:bg-eco-primary/90 transition-colors"
            >
              <UserRound size={20} />
              <span>Profile</span>
            </Link>
          </div>
        </div>

        <div className="text-center mb-8 animate-fade-in">
          <span className="inline-block px-4 py-1 bg-eco-muted text-eco-primary rounded-full text-sm font-medium mb-4">
            Sustainable Shopping Made Simple
          </span>
          <h1 className="text-4xl font-bold text-eco-secondary mb-4">
            Discover Eco-Friendly Products
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Find and compare sustainable products that match your values. Every purchase makes a difference for our planet.
          </p>
        </div>

        <Categories
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <div className="relative w-full max-w-xl mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id}
              id={product.id}
              title={product.title}
              description={product.description || ''}
              image={product.image_url || ''}
              price={product.price}
              sustainabilityScore={product.sustainability_score}
              ecoFeatures={product.eco_features}
              brand={product.brand}
            />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No products found. Try adjusting your search or category.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
