import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import EmptyState from '@/src/components/EmptyState';
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Image, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useScheduleStore } from '@/store/scheduleStore';
import { notificationService } from '@/services/notificationService';
import {
  eventsForDay, daysWithEvents, upcomingEvents, formatTime, formatShortDate, KIND_LABELS,
} from '@/lib/scheduleUtils';

const DAYS = ['S','M','T','W','T','F','S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function getFirstDayOfMonth(y,m){return new Date(y,m,1).getDay();}

export default function CalendarScreen(){
  const [year,setYear]=useState(() => new Date().getFullYear());
  const [month,setMonth]=useState(() => new Date().getMonth());
  const [selectedDay,setSelectedDay]=useState(() => new Date().getDate());
  const events = useScheduleStore((st) => st.events);
  const removeEvent = useScheduleStore((st) => st.removeEvent);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const daysInMonth=getDaysInMonth(year,month);
  const firstDay=getFirstDayOfMonth(year,month);
  const nowDate = new Date();
  const today = nowDate.getFullYear()===year && nowDate.getMonth()===month ? nowDate.getDate() : -1;

  const weeks=useMemo(()=>{
    const cells=[];
    for(let i=0;i<firstDay;i++) cells.push(null);
    for(let d=1;d<=daysInMonth;d++) cells.push(d);
    const rows=[];
    for(let i=0;i<cells.length;i+=7) rows.push(cells.slice(i,i+7));
    if(rows[rows.length-1].length<7) while(rows[rows.length-1].length<7) rows[rows.length-1].push(null);
    return rows;
  },[year,month]);

  const prevMonth=()=>{if(month===0){setMonth(11);setYear(year-1);}else setMonth(month-1);setSelectedDay(1);};
  const nextMonth=()=>{if(month===11){setMonth(0);setYear(year+1);}else setMonth(month+1);setSelectedDay(1);};

  const dayActivities = useMemo(() => eventsForDay(events, year, month, selectedDay), [events, year, month, selectedDay]);
  const activityDays = useMemo(() => daysWithEvents(events, year, month), [events, year, month]);
  const upcoming = useMemo(() => upcomingEvents(events, new Date(), 5), [events]);

  const confirmRemove = (event) => {
    Alert.alert('Remove from calendar?', event.title, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          notificationService.cancelReminder(event.notificationId);
          removeEvent(event.id);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>
        <Text style={s.pageTitle}>Calendar</Text>

        {/* Month nav */}
        <View style={s.monthRow}>
          <Pressable onPress={prevMonth}><Ionicons name="chevron-back" size={22} color="#000" /></Pressable>
          <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
          <Pressable onPress={nextMonth}><Ionicons name="chevron-forward" size={22} color="#000" /></Pressable>
        </View>

        {/* Calendar grid */}
        <View style={s.calCard}>
          <View style={s.dayHeaders}>{DAYS.map((d,i)=><Text key={i} style={s.dayHeader}>{d}</Text>)}</View>
          {weeks.map((row,ri)=>(
            <View key={ri} style={s.weekRow}>
              {row.map((d,ci)=>(
                <Pressable key={ci} style={[s.dayCell,d===selectedDay&&s.dayCellSelected,d===today&&d!==selectedDay&&s.dayCellToday]} onPress={()=>d&&setSelectedDay(d)}>
                  {d?<><Text style={[s.dayText,d===selectedDay&&s.dayTextSelected]}>{d}</Text>{activityDays.has(d)&&<View style={[s.activityDot,d===selectedDay&&{backgroundColor:'#FFF'}]} />}</>:null}
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        {/* Selected day details */}
        <Text style={s.sectionTitle}>{MONTHS[month]} {selectedDay}, {year}</Text>
        {dayActivities.length>0?dayActivities.map((a)=>(
          <Pressable key={a.id} style={s.actRow} onPress={()=>a.workoutId && router.push(`/workout/${a.workoutId}`)}>
            <View style={s.actIcon}><Ionicons name={a.kind==='run'?'fitness-outline':a.kind==='workout'?'barbell-outline':a.kind==='nutrition'?'nutrition-outline':'calendar-outline'} size={16} color="#000" /></View>
            <View style={s.actInfo}><Text style={s.actTitle}>{a.title}</Text><Text style={s.actTime}>{formatTime(a.start)}{a.notes?` · ${a.notes}`:''}</Text></View>
            <View style={[s.actBadge,a.kind==='run'&&{backgroundColor:'#333'}]}><Text style={s.actBadgeText}>{KIND_LABELS[a.kind]||'Event'}</Text></View>
            <Pressable onPress={()=>confirmRemove(a)} hitSlop={10} style={{marginLeft:10}}><Ionicons name="close-circle-outline" size={20} color="#999" /></Pressable>
          </Pressable>
        )):<Text style={s.noAct}>Nothing scheduled</Text>}
        <Pressable style={s.addActBtn}><Ionicons name="add" size={18} color="#999" /><Text style={s.addActText}>Add Activity</Text></Pressable>

        {/* Upcoming */}
        <Text style={[s.sectionTitle,{marginTop:20}]}>Upcoming</Text>
        {upcoming.length>0?upcoming.map((u)=>(
          <View key={u.id} style={s.upRow}><Text style={s.upDate}>{formatShortDate(u.start)}</Text><Text style={s.upTitle}>{u.title}</Text><Text style={s.upTime}>{formatTime(u.start)}</Text></View>
        )):(
          <Pressable onPress={()=>router.push('/coach')}><Text style={s.noAct}>Nothing coming up. Ask your AI Coach to plan your week.</Text></Pressable>
        )}

        {/* Quick log */}
        <Text style={[s.sectionTitle,{marginTop:20}]}>Quick Log</Text>
        <View style={s.quickRow}>
          {[{icon:'barbell-outline',label:'Log Workout',route:'/workouts'},{icon:'fitness-outline',label:'Log Run',route:'/running/program'},{icon:'nutrition-outline',label:'Log Meal',route:'/nutrition'},{icon:'heart-outline',label:'Log Health',route:'/health'}].map(q=>(
            <Pressable key={q.label} style={s.quickItem} onPress={()=>router.push(q.route)}>
              <View style={s.quickCircle}><Ionicons name={q.icon} size={20} color="#000" /></View>
              <Text style={s.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  pageTitle:{fontSize:24,fontWeight:'800',color:'#000',paddingHorizontal:20,marginBottom:8},
  monthRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:12},
  monthLabel:{fontSize:18,fontWeight:'700',color:'#000'},
  calCard:{backgroundColor:'#FFF',borderRadius:16,padding:12,marginHorizontal:20,marginBottom:20,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  dayHeaders:{flexDirection:'row',marginBottom:8},
  dayHeader:{flex:1,textAlign:'center',fontSize:12,fontWeight:'600',color:'#999'},
  weekRow:{flexDirection:'row'},
  dayCell:{flex:1,alignItems:'center',paddingVertical:8,borderRadius:20,minHeight:40,justifyContent:'center'},
  dayCellSelected:{backgroundColor:'#000'},
  dayCellToday:{borderWidth:1,borderColor:'#000'},
  dayText:{fontSize:14,fontWeight:'500',color:'#000'},
  dayTextSelected:{color:'#FFF',fontWeight:'700'},
  activityDot:{width:4,height:4,borderRadius:2,backgroundColor:'#000',marginTop:2},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000',paddingHorizontal:20,marginBottom:12},
  actRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  actIcon:{width:36,height:36,borderRadius:18,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  actInfo:{flex:1,marginLeft:12},
  actTitle:{fontSize:14,fontWeight:'600',color:'#000'},
  actTime:{fontSize:12,color:'#999',marginTop:2},
  actBadge:{backgroundColor:'#000',paddingHorizontal:8,paddingVertical:3,borderRadius:8},
  actBadgeText:{fontSize:10,fontWeight:'700',color:'#FFF'},
  noAct:{fontSize:14,color:'#999',paddingHorizontal:20,marginBottom:12},
  addActBtn:{flexDirection:'row',alignItems:'center',gap:6,marginHorizontal:20,marginTop:8,marginBottom:20,borderWidth:1,borderColor:'#E5E5E5',borderStyle:'dashed',borderRadius:12,padding:14,justifyContent:'center'},
  addActText:{fontSize:14,color:'#999'},
  upRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  upDate:{fontSize:13,fontWeight:'700',color:'#000',width:50},
  upTitle:{flex:1,fontSize:14,fontWeight:'600',color:'#000'},
  upTime:{fontSize:12,color:'#999'},
  quickRow:{flexDirection:'row',justifyContent:'space-around',paddingHorizontal:20,marginBottom:24},
  quickItem:{alignItems:'center'},
  quickCircle:{width:48,height:48,borderRadius:24,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  quickLabel:{fontSize:11,fontWeight:'600',color:'#000',marginTop:6,textAlign:'center'},
});
