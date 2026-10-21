import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useBattlePassStore } from '@/store/battlePassStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useHealthStore } from '@/store/healthStore';
import { useAchievementStore } from '@/store/achievementStore';
import { useLifetimeStore } from '@/store/lifetimeStore';
import { lifetimeOf } from '@/lib/lifetimeTotals';
import { localDateKey } from '@/lib/localDate';
import { sessionsOf, activityStreak } from '@/lib/activity';
import { buildMissions } from '@/lib/battlePassMissions';

const TIER_REWARDS = [
  {t:1,icon:'trophy',name:'Profile Badge'},
  {t:2,icon:'star',name:'100 Bonus XP'},
  {t:3,icon:'color-palette',name:'Dark Gold Theme'},
  {t:4,icon:'barbell',name:'HIIT Elite'},
  {t:5,icon:'nutrition',name:'Power Smoothie'},
  {t:6,icon:'star',name:'200 Bonus XP'},
  {t:7,icon:'person',name:'Avatar Frame'},
  {t:8,icon:'map',name:'Beach 10K Route'},
  {t:9,icon:'star',name:'300 Bonus XP'},
  {t:10,icon:'barbell',name:'Titan Core'},
  {t:11,icon:'flame',name:'Fire Streak Badge'},
  {t:12,icon:'restaurant',name:'Meal Prep Pack'},
  {t:13,icon:'star',name:'500 Bonus XP'},
  {t:14,icon:'pricetag',name:'20% Gear Discount'},
  {t:15,icon:'fitness',name:'Pro Running Plan'},
  {t:16,icon:'star',name:'750 Bonus XP'},
  {t:17,icon:'color-palette',name:'Neon Theme'},
  {t:18,icon:'star',name:'1000 Bonus XP'},
  {t:19,icon:'shield',name:'Champion Badge'},
  {t:20,icon:'ribbon',name:'OWN THE DAY Title'},
];

const SEASON_START = new Date('2026-06-01T00:00:00');
const SEASON_LENGTH_DAYS = 90;

const ACH_W = (Dimensions.get('window').width - 52) / 2;

function TierCard({tier, onClaim, busy}){
  const {claimed, current, locked} = tier;
  const bg = claimed ? '#000' : current ? '#FFF' : '#F5F5F5';
  const border = claimed ? '#FFD700' : current ? '#FFD700' : '#E5E5E5';
  const iconColor = claimed ? '#FFD700' : current ? '#000' : '#CCC';
  return (
    <View style={s.tierCol}>
      <View style={s.tierNum}><Text style={s.tierNumText}>{tier.t}</Text></View>
      <View style={[s.tierBox,{backgroundColor:bg,borderColor:border}]}>
        <Ionicons name={tier.icon} size={32} color={iconColor} />
        <Text style={[s.tierName,{color:claimed?'#FFF':current?'#000':'#999'}]} numberOfLines={2}>{tier.name}</Text>
        {claimed && <Text style={s.tierClaimed}>CLAIMED</Text>}
        {current && <Pressable style={[s.claimBtn, busy && {opacity:0.5}]} onPress={onClaim} disabled={busy}><Text style={s.claimBtnText}>CLAIM</Text></Pressable>}
        {locked && <Text style={s.tierXpNeed}>{tier.xpNeeded} XP</Text>}
      </View>
    </View>
  );
}

function MissionRow({m}){
  const pct = Math.min(100,Math.round(m.current/m.target*100));
  return (
    <View style={s.missionCard}>
      <View style={s.missionInfo}>
        <Text style={s.missionTitle}>{m.title}</Text>
        <View style={s.missionBarBg}><View style={[s.missionBarFill,{width:pct+'%'}]} /></View>
        <Text style={s.missionProg}>{m.current}{m.unit||''}/{m.target}{m.unit||''}</Text>
      </View>
      <View style={s.missionXpBadge}><Text style={s.missionXpText}>+{m.xp}</Text></View>
    </View>
  );
}


export default function BattlePassScreen(){
  const { user } = useUserStore();
  const uid = user?.uid;
  const { getLevel, getExpForLevel, getExpToNextLevel, getTotalExp, loadXP } = useExpStore();
  // Real fix: same bug as app/profile.jsx - totalExp destructured
  // directly from useExpStore() was always undefined, since that
  // top-level property never existed on the store.
  const totalExp = getTotalExp ? getTotalExp() : 0;
  const { claimedTiers, claimTier, claiming, loadBattlePass } = useBattlePassStore();
  const { completedWorkouts, loadWorkouts } = useWorkoutStore();
  const serverTotals = useLifetimeStore((st) => st.totals);
  const { runs, loadRuns } = useRunningStore();
  const { completedHikes, loadCompletedHikes } = useHikingStore();
  const { getMealsByDate, loadNutritionData, meals } = useNutritionStore();
  const { steps, stepsDate, loadAllHealth } = useHealthStore();
  const { achievements, getUnlockedAchievements, getLockedAchievements, loadAchievements } = useAchievementStore();

  useEffect(() => {
    if (uid) {
      loadXP(uid);
      loadBattlePass(uid);
      loadWorkouts?.(uid);
      loadRuns?.(uid);
      loadCompletedHikes?.(uid);
      loadNutritionData(uid);
      loadAllHealth(uid);
      loadAchievements(uid);
    }
  }, [uid]);

  const [track,setTrack]=useState('Free');
  const [achCat, setAchCat] = useState('All');
  const [showAllAch, setShowAllAch] = useState(false);

  const xpLevel = getLevel ? getLevel() : 1;
  const seasonMaxTier = TIER_REWARDS.length;
  const currentLevelThreshold = getExpForLevel ? getExpForLevel(xpLevel) : 0;
  const nextLevelThreshold = getExpForLevel ? getExpForLevel(xpLevel + 1) : currentLevelThreshold + 1000;
  const xpIntoLevel = Math.max(0, (totalExp || 0) - currentLevelThreshold);
  const xpNeededForLevel = Math.max(1, nextLevelThreshold - currentLevelThreshold);
  const seasonPct = Math.min(100, Math.max(0, (xpIntoLevel / xpNeededForLevel) * 100));
  const xpRemaining = getExpToNextLevel ? getExpToNextLevel() : 0;

  const daysLeft = Math.max(0, SEASON_LENGTH_DAYS - Math.floor((Date.now() - SEASON_START.getTime()) / (1000*60*60*24)));

  const TIERS = useMemo(() => {
    const firstUnclaimedEligible = TIER_REWARDS.find(t => xpLevel >= t.t && !claimedTiers.includes(t.t));
    return TIER_REWARDS.map((t) => {
      const claimed = claimedTiers.includes(t.t);
      const eligible = xpLevel >= t.t;
      const current = !claimed && eligible && firstUnclaimedEligible?.t === t.t;
      return {
        ...t,
        claimed,
        current,
        locked: !eligible,
        xpNeeded: getExpForLevel ? getExpForLevel(t.t) : t.t * 1000,
      };
    });
  }, [xpLevel, claimedTiers]);

  // A tier is claimed on the server, which checks the level in the person's XP ledger has reached it. The tier shows as claimed once the
  // server has recorded it, so a claim that fails or is turned away is said so here and the tier stays to be claimed.
  const handleClaim = async (tierNum) => {
    const status = await claimTier(tierNum);
    if (status === 'locked') {
      Alert.alert('Not Yet', 'Your level has not reached this tier yet.');
    } else if (status === 'failed') {
      Alert.alert('Could Not Claim', 'The tier could not be claimed. Check your connection and try again.');
    }
  };

  // The missions are worked out in lib/battlePassMissions.js, which the Battle Pass card on Home uses too. `meals` is in the list
  // so the meals mission moves when a meal is logged (getMealsByDate is the same function every time, so it never would).
  const missions = useMemo(() => {
    const now = new Date();
    return buildMissions({
      completedWorkouts,
      runs,
      completedHikes,
      steps,
      stepsDate,
      mealsToday: getMealsByDate ? getMealsByDate(localDateKey(now)) : [],
      now,
    });
  }, [completedWorkouts, runs, completedHikes, steps, stepsDate, getMealsByDate, meals]);

  const hoursUntilMidnight = useMemo(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.max(0, Math.ceil((midnight - now) / (1000 * 60 * 60)));
  }, []);

  const achCategories = useMemo(() => {
    const cats = new Set(achievements.map(a => a.category));
    return ['All', ...Array.from(cats)];
  }, [achievements]);

  // Days in a row with a workout, a run or a hike, worked out from those records (not a stored counter).
  const today = localDateKey();
  const currentStreak = useMemo(
    () => activityStreak(sessionsOf({ workouts: completedWorkouts, runs, hikes: completedHikes }), today).current,
    [completedWorkouts, runs, completedHikes, today],
  );

  // The workouts achievements count every finished workout there has ever been (the server's count), not just the newest 240 the phone holds.
  const lifetime = useMemo(() => lifetimeOf({ held: completedWorkouts, server: serverTotals }), [completedWorkouts, serverTotals]);

  const achProgress = useMemo(() => {
    const progress = {};
    achievements.forEach((a) => {
      const { type, target } = a.condition || {};
      switch (type) {
        case 'workout_count':
          progress[a.id] = { current: lifetime.finishedWorkouts, target };
          break;
        case 'streak':
          progress[a.id] = { current: currentStreak, target };
          break;
        case 'level':
          progress[a.id] = { current: xpLevel, target };
          break;
        case 'xp':
          progress[a.id] = { current: totalExp || 0, target };
          break;
        case 'calories_burned':
          progress[a.id] = { current: lifetime.bestCalories, target };
          break;
        default:
          progress[a.id] = null;
      }
    });
    return progress;
  }, [achievements, lifetime, currentStreak, xpLevel, totalExp]);

  const filteredAch = useMemo(() => {
    const allEarned = getUnlockedAchievements();
    const allLocked = getLockedAchievements();
    const earned = achCat === 'All' ? allEarned : allEarned.filter(a => a.category === achCat);
    const locked = achCat === 'All' ? allLocked : allLocked.filter(a => a.category === achCat);
    return { earned, locked };
  }, [achCat, achievements]);

  const visibleAch = showAllAch ? [...filteredAch.earned, ...filteredAch.locked] : [...filteredAch.earned, ...filteredAch.locked].slice(0, 6);
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>

        <View style={s.banner}>
          <Text style={s.seasonLabel}>SEASON 1</Text>
          <Text style={s.seasonTitle}>OWN THE DAY</Text>
          <Text style={s.seasonDate}>{SEASON_START.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
          <View style={s.seasonBarBg}><View style={[s.seasonBarFill,{width:seasonPct+'%'}]} /></View>
          <View style={s.seasonRow}><Text style={s.seasonLevel}>Level {xpLevel} / {seasonMaxTier}</Text><Text style={s.seasonDays}>{daysLeft} days left</Text></View>
        </View>

        <View style={s.xpRow}><Text style={s.xpLabel}>Current XP: <Text style={s.xpBold}>{(totalExp||0).toLocaleString()}</Text></Text><Text style={s.xpLabel}>Next Tier: <Text style={s.xpBold}>{xpRemaining.toLocaleString()} XP</Text></Text></View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tierScroll}>
          {TIERS.map(t=><TierCard key={t.t} tier={t} busy={claiming === t.t} onClaim={() => handleClaim(t.t)} />)}
        </ScrollView>

        <View style={s.trackRow}>
          {['Free','Premium'].map(t=>(<Pressable key={t} style={[s.trackPill,track===t&&s.trackPillActive]} onPress={()=>setTrack(t)}><Text style={[s.trackText,track===t&&s.trackTextActive]}>{t} Track</Text></Pressable>))}
        </View>

        {track==='Premium' && (
          <View style={s.premiumCard}>
            <Text style={s.premiumTitle}>Upgrade to Premium</Text>
            <Text style={s.premiumPrice}>$9.99 / season</Text>
            {['Unlock all 20 tiers','Exclusive gear discounts','Premium recipes & workouts','Custom themes'].map(b=>(<View key={b} style={s.benefitRow}><Ionicons name="checkmark-circle" size={16} color="#FFD700" /><Text style={s.benefitText}>{b}</Text></View>))}
            <Pressable style={s.upgradeBtn} onPress={() => Alert.alert('Not Available Yet', 'Premium purchases aren\'t set up yet. Check back soon.')}>
              <Text style={s.upgradeBtnText}>Upgrade Now</Text>
            </Pressable>
          </View>
        )}

        <View style={s.missionHeader}><Text style={s.sectionTitle}>Missions</Text><Text style={s.resetTimer}>Resets in {hoursUntilMidnight}h</Text></View>
        <Text style={s.missionGroup}>Daily</Text>
        {missions.daily.map((m,i)=><MissionRow key={i} m={m} />)}
        <Text style={s.missionGroup}>Weekly</Text>
        {missions.weekly.map((m,i)=><MissionRow key={i} m={m} />)}

        <View style={s.missionHeader}>
          <Text style={s.sectionTitle}>Achievements</Text>
          <Text style={s.resetTimer}>{getUnlockedAchievements().length}/{achievements.length}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingLeft:20,paddingRight:6,marginBottom:16}}>
          {achCategories.map(c => (
            <Pressable key={c} style={{backgroundColor: achCat === c ? '#000' : '#F0F0F0', paddingHorizontal:16, paddingVertical:8, borderRadius:20, marginRight:8}} onPress={() => setAchCat(c)}>
              <Text style={{fontSize:13, fontWeight:'700', color: achCat === c ? '#FFF' : '#333'}}>{c === 'All' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',paddingHorizontal:20,marginBottom:12}}>
          {visibleAch.map(a => {
            const isEarned = !!a.unlockedAt;
            const prog = achProgress[a.id];
            return (
              <View key={a.id} style={{width:ACH_W,backgroundColor:'#FFF',borderRadius:16,padding:16,marginBottom:12,alignItems:'center',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2}},android:{elevation:2},default:{}})}}>
                <View style={{width:56,height:56,borderRadius:28,backgroundColor:isEarned?'#000':'#F0F0F0',justifyContent:'center',alignItems:'center',marginBottom:10}}>
                  <Text style={{fontSize:26}}>{a.icon}</Text>
                  {!isEarned && <View style={{position:'absolute',bottom:-2,right:-2,backgroundColor:'#FFF',borderRadius:8,padding:2}}><Ionicons name="lock-closed" size={12} color="#999" /></View>}
                </View>
                <Text style={{fontSize:13,fontWeight:'700',color:'#000',textAlign:'center',marginBottom:4}}>{a.name}</Text>
                {isEarned ? (
                  <Text style={{fontSize:12,fontWeight:'600',color:'#22C55E'}}>+{a.xpReward} XP</Text>
                ) : prog ? (
                  <Text style={{fontSize:11,color:'#999'}}>{Math.min(prog.current, prog.target)}/{prog.target}</Text>
                ) : (
                  <Text style={{fontSize:11,color:'#999',textAlign:'center'}}>{a.description}</Text>
                )}
              </View>
            );
          })}
        </View>

        {!showAllAch && filteredAch.earned.length + filteredAch.locked.length > 6 && (
          <Pressable style={{alignItems:'center',marginBottom:24}} onPress={() => setShowAllAch(true)}>
            <Text style={{fontSize:14,fontWeight:'700',color:'#000'}}>View All Achievements</Text>
          </Pressable>
        )}
        {showAllAch && (
          <Pressable style={{alignItems:'center',marginBottom:24}} onPress={() => setShowAllAch(false)}>
            <Text style={{fontSize:14,fontWeight:'700',color:'#999'}}>Show Less</Text>
          </Pressable>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  banner:{backgroundColor:'#000',borderRadius:16,marginHorizontal:20,padding:20,marginBottom:20},
  seasonLabel:{fontSize:12,color:'#999',textTransform:'uppercase',letterSpacing:2},
  seasonTitle:{fontSize:28,fontWeight:'900',color:'#FFF',marginTop:4},
  seasonDate:{fontSize:13,color:'#666',marginTop:2,marginBottom:12},
  seasonBarBg:{height:6,borderRadius:3,backgroundColor:'#333',overflow:'hidden'},
  seasonBarFill:{height:6,borderRadius:3,backgroundColor:'#FFD700'},
  seasonRow:{flexDirection:'row',justifyContent:'space-between',marginTop:8},
  seasonLevel:{fontSize:12,fontWeight:'700',color:'#FFD700'},
  seasonDays:{fontSize:12,color:'#999'},
  xpRow:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:20,marginBottom:16},
  xpLabel:{fontSize:13,color:'#666'},
  xpBold:{fontWeight:'700',color:'#000'},
  tierScroll:{paddingLeft:20,paddingRight:6,marginBottom:20},
  tierCol:{alignItems:'center',marginRight:2},
  tierNum:{width:24,height:24,borderRadius:12,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center',marginBottom:4},
  tierNumText:{fontSize:11,fontWeight:'700',color:'#000'},
  tierBox:{width:110,height:140,borderRadius:12,padding:10,alignItems:'center',justifyContent:'center',borderWidth:2},
  tierName:{fontSize:11,fontWeight:'600',marginTop:6,textAlign:'center'},
  tierClaimed:{fontSize:8,fontWeight:'800',color:'#FFD700',marginTop:4},
  claimBtn:{backgroundColor:'#FFD700',paddingHorizontal:12,paddingVertical:4,borderRadius:8,marginTop:6},
  claimBtnText:{fontSize:10,fontWeight:'800',color:'#000'},
  tierXpNeed:{fontSize:10,color:'#999',marginTop:4},
  trackRow:{flexDirection:'row',gap:8,paddingHorizontal:20,marginBottom:16},
  trackPill:{flex:1,paddingVertical:10,borderRadius:20,backgroundColor:'#F0F0F0',alignItems:'center'},
  trackPillActive:{backgroundColor:'#000'},
  trackText:{fontSize:13,fontWeight:'700',color:'#333'},
  trackTextActive:{color:'#FFF'},
  premiumCard:{backgroundColor:'#F5F5F5',borderRadius:16,padding:20,marginHorizontal:20,marginBottom:20},
  premiumTitle:{fontSize:18,fontWeight:'700',color:'#000'},
  premiumPrice:{fontSize:14,color:'#666',marginTop:2,marginBottom:12},
  benefitRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},
  benefitText:{fontSize:13,color:'#333'},
  upgradeBtn:{backgroundColor:'#000',height:48,borderRadius:24,justifyContent:'center',alignItems:'center',marginTop:12},
  upgradeBtnText:{fontSize:16,fontWeight:'700',color:'#FFF'},
  missionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:8},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000'},
  resetTimer:{fontSize:12,color:'#999'},
  missionGroup:{fontSize:13,fontWeight:'600',color:'#999',textTransform:'uppercase',paddingHorizontal:20,marginTop:12,marginBottom:8},
  missionCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:12,padding:14,marginHorizontal:20,marginBottom:8,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2}},android:{elevation:2},default:{shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2}}})},
  missionInfo:{flex:1},
  missionTitle:{fontSize:14,fontWeight:'600',color:'#000',marginBottom:6},
  missionBarBg:{height:4,borderRadius:2,backgroundColor:'#E5E5E5',overflow:'hidden',marginBottom:4},
  missionBarFill:{height:4,borderRadius:2,backgroundColor:'#000'},
  missionProg:{fontSize:11,color:'#999'},
  missionXpBadge:{backgroundColor:'#F0F0F0',paddingHorizontal:10,paddingVertical:6,borderRadius:10,marginLeft:10},
  missionXpText:{fontSize:12,fontWeight:'700',color:'#000'},
});
