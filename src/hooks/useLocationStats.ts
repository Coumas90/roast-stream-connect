import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LocationStats {
  locationId: string;
  locationName: string;
  activeProfiles: number;
  todayCalibrations: number;
  avgRatio: number | null;
  avgTime: number | null;
  hoppersFilled: number;
  totalHoppers: number;
}

export function useLocationStats(locationId?: string) {
  return useQuery({
    queryKey: ['location-stats', locationId],
    queryFn: async () => {
      if (!locationId) return null;
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get location name
      const { data: location } = await supabase
        .from('locations')
        .select('name')
        .eq('id', locationId)
        .single();
      
      // Get active coffee profiles count
      const { data: profiles } = await supabase
        .from('coffee_profiles')
        .select('id')
        .eq('location_id', locationId)
        .eq('active', true);
      
      // Get today's calibrations
      const { data: calibrations } = await supabase
        .from('calibration_entries')
        .select('ratio_calc, time_s, coffee_profile_id')
        .eq('fecha', today)
        .in('coffee_profile_id', profiles?.map(p => p.id) || []);
      
      // Get hoppers stock
      const { data: hoppers } = await supabase
        .from('location_stock_readonly')
        .select('hopper_number, current_kg')
        .eq('location_id', locationId);
      
      const avgRatio = calibrations && calibrations.length > 0
        ? calibrations.reduce((sum, c) => sum + (c.ratio_calc || 0), 0) / calibrations.length
        : null;
      
      const avgTime = calibrations && calibrations.length > 0
        ? calibrations.reduce((sum, c) => sum + (c.time_s || 0), 0) / calibrations.length
        : null;
      
      return {
        locationId,
        locationName: location?.name || 'Unknown',
        activeProfiles: profiles?.length || 0,
        todayCalibrations: calibrations?.length || 0,
        avgRatio,
        avgTime,
        hoppersFilled: hoppers?.filter(h => h.current_kg > 0).length || 0,
        totalHoppers: hoppers?.length || 0,
      } as LocationStats;
    },
    enabled: !!locationId,
  });
}

export function useTenantLocationsStats(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant-locations-stats', tenantId],
    queryFn: async () => {
      // Get accessible locations (will return all for current tenant)
      const { data: accessibleLocs, error: accessError } = await supabase
        .rpc('get_accessible_locations');
      
      if (accessError) throw accessError;
      
      const locations = accessibleLocs || [];
      
      const today = new Date().toISOString().split('T')[0];
      
      const statsPromises = locations.map(async (loc) => {
        const { data: profiles } = await supabase
          .from('coffee_profiles')
          .select('id')
          .eq('location_id', loc.id)
          .eq('active', true);
        
        const { data: calibrations } = await supabase
          .from('calibration_entries')
          .select('ratio_calc, time_s')
          .eq('fecha', today)
          .in('coffee_profile_id', profiles?.map(p => p.id) || []);
        
        const { data: hoppers } = await supabase
          .from('location_stock_readonly')
          .select('current_kg')
          .eq('location_id', loc.id);
        
        const avgRatio = calibrations && calibrations.length > 0
          ? calibrations.reduce((sum, c) => sum + (c.ratio_calc || 0), 0) / calibrations.length
          : null;
        
        const avgTime = calibrations && calibrations.length > 0
          ? calibrations.reduce((sum, c) => sum + (c.time_s || 0), 0) / calibrations.length
          : null;
        
        return {
          locationId: loc.id,
          locationName: loc.name,
          activeProfiles: profiles?.length || 0,
          todayCalibrations: calibrations?.length || 0,
          avgRatio,
          avgTime,
          hoppersFilled: hoppers?.filter(h => h.current_kg > 0).length || 0,
          totalHoppers: hoppers?.length || 0,
        } as LocationStats;
      });
      
      return Promise.all(statsPromises);
    },
  });
}
